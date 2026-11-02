namespace MealPlan.Core.Data

open System
open System.Threading
open Microsoft.Data.Sqlite

type SqliteIngredientRepository(connectionString: string) =

    let notFound (id: Guid) = $"No ingredient with id %O{id}."

    let read (reader: Data.Common.DbDataReader) =
        { Id = Sqlite.readGuid reader 0
          Name = reader.GetString 1
          Category = reader.GetString 2 }

    let readAll ct =
        Sqlite.transact connectionString ct (fun conn tx ->
            task {
                use cmd =
                    Sqlite.command conn tx "SELECT id, name, category FROM ingredients ORDER BY name" []

                let! ingredients = Sqlite.rows cmd ct read
                return Ok ingredients
            })

    interface IRepository<Guid, IngredientEntity> with

        member _.Get(id, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    use cmd =
                        Sqlite.command conn tx "SELECT id, name, category FROM ingredients WHERE id = $id" [ "$id", Sqlite.guid id ]

                    match! Sqlite.firstRow cmd ct read with
                    | Some ingredient -> return Ok ingredient
                    | None -> return Error(notFound id)
                })

        member _.Add(ingredient, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    use cmd =
                        Sqlite.command
                            conn
                            tx
                            "INSERT INTO ingredients (id, name, category) VALUES ($id, $name, $category)"
                            [ "$id", Sqlite.guid ingredient.Id
                              "$name", box ingredient.Name
                              "$category", box ingredient.Category ]

                    try
                        let! _ = cmd.ExecuteNonQueryAsync ct
                        return Ok ingredient
                    with :? SqliteException as ex when ex.SqliteErrorCode = Sqlite.constraintError ->
                        return Error $"An ingredient with id %O{ingredient.Id} already exists."
                })

        member _.Update(ingredient, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    use cmd =
                        Sqlite.command
                            conn
                            tx
                            "UPDATE ingredients SET name = $name, category = $category WHERE id = $id"
                            [ "$id", Sqlite.guid ingredient.Id
                              "$name", box ingredient.Name
                              "$category", box ingredient.Category ]

                    match! cmd.ExecuteNonQueryAsync ct with
                    | 0 -> return Error(notFound ingredient.Id)
                    | _ -> return Ok ingredient
                })

        member _.Delete(id, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    use cmd =
                        Sqlite.command conn tx "DELETE FROM ingredients WHERE id = $id" [ "$id", Sqlite.guid id ]

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
