namespace MealPlan.Core

open System
open System.Threading
open MealPlan.Core.Data

/// Recipes over a repository, in the shape of `Ingredients`.
///
/// Reading is the awkward direction. A stored recipe holds ingredient *ids*,
/// and `Mapping.Domain.recipe` rehydrates them through a resolver that is
/// synchronous — but a repository's `Get` is not. So every read loads the
/// ingredient catalogue once up front and resolves against that map, which
/// also keeps a list of recipes to two queries rather than one per ingredient.
module Recipes =

    /// Validation failures and store failures arrive differently — the first as
    /// a list the domain built, the second as a message the repository wrote.
    type RecipeError =
        | Invalid of AddRecipeError list
        | Failed of string

    let private missingIngredient (id: Guid) = $"No ingredient with id %O{id}."

    /// Loads the ingredient catalogue as a lookup for `Mapping.Domain.recipe`.
    let private resolver (ingredients: IRepository<Guid, IngredientEntity>) ct =
        task {
            match! ingredients.All ct with
            | Error message -> return Error message
            | Ok found ->
                let byId = found |> List.map (fun i -> i.Id, i) |> Map.ofList

                return
                    Ok(fun id ->
                        byId
                        |> Map.tryFind id
                        |> Option.map Ok
                        |> Option.defaultValue (Error(missingIngredient id)))
        }

    /// Runs `read` with a resolver, then rehydrates whatever it returned.
    let private withResolver ingredients ct (read: unit -> Threading.Tasks.Task<Result<'E, string>>) rehydrate =
        task {
            match! resolver ingredients ct with
            | Error message -> return Error(Failed message)
            | Ok resolve ->
                match! read () with
                | Error message -> return Error(Failed message)
                | Ok entity ->
                    return
                        rehydrate resolve entity
                        |> Result.mapError Failed
        }

    let get (recipes: IRepository<Guid, RecipeEntity>) ingredients (id: Guid) ct =
        withResolver ingredients ct (fun () -> recipes.Get(id, ct)) Mapping.Domain.recipe

    let all (recipes: IRepository<Guid, RecipeEntity>) ingredients ct =
        withResolver ingredients ct (fun () -> recipes.All ct) (fun resolve found ->
            // Keeping the first failure matches `Mapping`'s own traverse: one
            // dangling ingredient id makes the whole listing untrustworthy.
            (Ok [], found)
            ||> List.fold (fun state entity ->
                match state, Mapping.Domain.recipe resolve entity with
                | Ok mapped, Ok recipe -> Ok(recipe :: mapped)
                | Error message, _
                | _, Error message -> Error message)
            |> Result.map List.rev)

    /// Validates, stores, and returns the recipe as it was stored. `write` is
    /// the repository's `Add` or `Update`.
    let private save write (recipe: Recipe) =
        task {
            match RecipeService.validate Guid.NewGuid recipe with
            | Error errors -> return Error(Invalid errors)
            | Ok normalised ->
                match! write (Mapping.Entities.recipe normalised) with
                | Error message -> return Error(Failed message)
                // The stored entity drops back to ids, so the normalised
                // recipe we already hold is the better thing to hand back.
                | Ok _ -> return Ok normalised
        }

    let add (recipes: IRepository<Guid, RecipeEntity>) (recipe: Recipe) ct =
        save (fun entity -> recipes.Add(entity, ct)) recipe

    let update (recipes: IRepository<Guid, RecipeEntity>) (recipe: Recipe) ct =
        save (fun entity -> recipes.Update(entity, ct)) recipe

    let delete (recipes: IRepository<Guid, RecipeEntity>) (id: Guid) (ct: CancellationToken) =
        task {
            let! deleted = recipes.Delete(id, ct)
            return deleted |> Result.mapError Failed
        }
