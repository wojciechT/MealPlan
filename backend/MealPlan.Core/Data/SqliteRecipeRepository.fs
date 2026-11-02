namespace MealPlan.Core.Data

open System
open System.Threading
open Microsoft.Data.Sqlite

/// A recipe is spread over four tables, so every member here runs inside the
/// transaction `Sqlite.transact` opens.
type SqliteRecipeRepository(connectionString: string) =

    let notFound (id: Guid) = $"No recipe with id %O{id}."

    let readSteps conn tx ct (id: Guid) =
        use cmd =
            Sqlite.command conn tx "SELECT text FROM recipe_steps WHERE recipe_id = $id ORDER BY ordinal" [ "$id", Sqlite.guid id ]

        Sqlite.rows cmd ct (fun reader -> reader.GetString 0)

    let readIngredients conn tx ct (id: Guid) =
        use cmd =
            Sqlite.command
                conn
                tx
                "SELECT ingredient_id, amount, unit FROM recipe_ingredients WHERE recipe_id = $id ORDER BY ordinal"
                [ "$id", Sqlite.guid id ]

        Sqlite.rows cmd ct (fun reader ->
            { Ingredient = Sqlite.readGuid reader 0
              Quantity =
                { Amount = uint (reader.GetInt64 1)
                  Unit = Sqlite.readUnit reader 2 } })

    let readTags conn tx ct (id: Guid) =
        use cmd =
            Sqlite.command conn tx "SELECT tag FROM recipe_tags WHERE recipe_id = $id ORDER BY ordinal" [ "$id", Sqlite.guid id ]

        Sqlite.rows cmd ct (fun reader -> reader.GetString 0)

    /// Reads the recipe row on its own so the reader is closed before the
    /// child tables are queried on the same connection.
    let readRecipe conn tx ct (id: Guid) =
        use cmd =
            Sqlite.command conn tx "SELECT name, reference FROM recipes WHERE id = $id" [ "$id", Sqlite.guid id ]

        Sqlite.firstRow cmd ct (fun reader -> reader.GetString 0, Sqlite.readOptional reader 1)

    /// Groups `(ownerId, value)` pairs, keeping the order the rows came back in.
    let byOwner pairs =
        pairs
        |> List.groupBy fst
        |> List.map (fun (owner, values) -> owner, List.map snd values)
        |> Map.ofList

    let childrenOf id map =
        map |> Map.tryFind id |> Option.defaultValue []

    /// Loads every recipe with four queries rather than one per recipe.
    let readAll ct =
        Sqlite.transact connectionString ct (fun conn tx ->
            task {
                let! steps =
                    use cmd =
                        Sqlite.command conn tx "SELECT recipe_id, text FROM recipe_steps ORDER BY recipe_id, ordinal" []

                    Sqlite.rows cmd ct (fun reader -> Sqlite.readGuid reader 0, reader.GetString 1)

                let! ingredients =
                    use cmd =
                        Sqlite.command
                            conn
                            tx
                            "SELECT recipe_id, ingredient_id, amount, unit FROM recipe_ingredients ORDER BY recipe_id, ordinal"
                            []

                    Sqlite.rows cmd ct (fun reader ->
                        Sqlite.readGuid reader 0,
                        { Ingredient = Sqlite.readGuid reader 1
                          Quantity =
                            { Amount = uint (reader.GetInt64 2)
                              Unit = Sqlite.readUnit reader 3 } })

                let! tags =
                    use cmd =
                        Sqlite.command conn tx "SELECT recipe_id, tag FROM recipe_tags ORDER BY recipe_id, ordinal" []

                    Sqlite.rows cmd ct (fun reader -> Sqlite.readGuid reader 0, reader.GetString 1)

                let steps = byOwner steps
                let ingredients = byOwner ingredients
                let tags = byOwner tags

                use cmd = Sqlite.command conn tx "SELECT id, name, reference FROM recipes ORDER BY name" []

                let! recipes =
                    Sqlite.rows cmd ct (fun reader ->
                        let id = Sqlite.readGuid reader 0

                        { Id = id
                          Name = reader.GetString 1
                          Steps = childrenOf id steps
                          Ingredients = childrenOf id ingredients
                          Reference = Sqlite.readOptional reader 2
                          Tags = childrenOf id tags })

                return Ok recipes
            })

    let writeChildren conn tx ct (recipe: RecipeEntity) =
        task {
            for ordinal, text in List.indexed recipe.Steps do
                use cmd =
                    Sqlite.command
                        conn
                        tx
                        "INSERT INTO recipe_steps (recipe_id, ordinal, text) VALUES ($id, $ordinal, $text)"
                        [ "$id", Sqlite.guid recipe.Id; "$ordinal", box ordinal; "$text", box text ]

                let! _ = cmd.ExecuteNonQueryAsync ct
                ()

            for ordinal, ingredient in List.indexed recipe.Ingredients do
                use cmd =
                    Sqlite.command
                        conn
                        tx
                        "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, ordinal, amount, unit)
                         VALUES ($id, $ingredient, $ordinal, $amount, $unit)"
                        [ "$id", Sqlite.guid recipe.Id
                          "$ingredient", Sqlite.guid ingredient.Ingredient
                          "$ordinal", box ordinal
                          "$amount", box (int64 ingredient.Quantity.Amount)
                          "$unit", box (Sqlite.unitText ingredient.Quantity.Unit) ]

                let! _ = cmd.ExecuteNonQueryAsync ct
                ()

            for ordinal, tag in List.indexed recipe.Tags do
                use cmd =
                    Sqlite.command
                        conn
                        tx
                        "INSERT INTO recipe_tags (recipe_id, tag, ordinal) VALUES ($id, $tag, $ordinal)"
                        [ "$id", Sqlite.guid recipe.Id; "$tag", box tag; "$ordinal", box ordinal ]

                let! _ = cmd.ExecuteNonQueryAsync ct
                ()
        }

    let deleteChildren conn tx ct (id: Guid) =
        task {
            for table in [ "recipe_steps"; "recipe_ingredients"; "recipe_tags" ] do
                use cmd =
                    Sqlite.command conn tx $"DELETE FROM %s{table} WHERE recipe_id = $id" [ "$id", Sqlite.guid id ]

                let! _ = cmd.ExecuteNonQueryAsync ct
                ()
        }

    interface IRepository<Guid, RecipeEntity> with

        member _.Get(id, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    match! readRecipe conn tx ct id with
                    | None -> return Error(notFound id)
                    | Some(name, reference) ->
                        let! steps = readSteps conn tx ct id
                        let! ingredients = readIngredients conn tx ct id
                        let! tags = readTags conn tx ct id

                        return
                            Ok
                                { Id = id
                                  Name = name
                                  Steps = steps
                                  Ingredients = ingredients
                                  Reference = reference
                                  Tags = tags }
                })

        member _.Add(recipe, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    // Only the recipes row is guarded here: a constraint failure on a
                    // child row means a missing ingredient, not a duplicate recipe.
                    let insertRecipe () =
                        task {
                            use cmd =
                                Sqlite.command
                                    conn
                                    tx
                                    "INSERT INTO recipes (id, name, reference) VALUES ($id, $name, $reference)"
                                    [ "$id", Sqlite.guid recipe.Id
                                      "$name", box recipe.Name
                                      "$reference", Sqlite.optional recipe.Reference ]

                            try
                                let! _ = cmd.ExecuteNonQueryAsync ct
                                return Ok()
                            with :? SqliteException as ex when ex.SqliteErrorCode = Sqlite.constraintError ->
                                return Error $"A recipe with id %O{recipe.Id} already exists."
                        }

                    match! insertRecipe () with
                    | Error message -> return Error message
                    | Ok() ->
                        do! writeChildren conn tx ct recipe
                        return Ok recipe
                })

        member _.Update(recipe, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    use cmd =
                        Sqlite.command
                            conn
                            tx
                            "UPDATE recipes SET name = $name, reference = $reference WHERE id = $id"
                            [ "$id", Sqlite.guid recipe.Id
                              "$name", box recipe.Name
                              "$reference", Sqlite.optional recipe.Reference ]

                    match! cmd.ExecuteNonQueryAsync ct with
                    | 0 -> return Error(notFound recipe.Id)
                    | _ ->
                        do! deleteChildren conn tx ct recipe.Id
                        do! writeChildren conn tx ct recipe
                        return Ok recipe
                })

        member _.Delete(id, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    use cmd = Sqlite.command conn tx "DELETE FROM recipes WHERE id = $id" [ "$id", Sqlite.guid id ]

                    match! cmd.ExecuteNonQueryAsync ct with
                    | 0 -> return Error(notFound id)
                    | _ -> return Ok()
                })

        member _.All(ct) = readAll ct

        member _.Query(predicate, ct) =
            task {
                let! all = readAll ct
                return all |> Result.map (List.filter predicate)
            }
