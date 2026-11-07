namespace MealPlan.Core

open System
open System.Threading
open MealPlan.Core.Data

module Ingredients =
    /// Runs `write` unless another ingredient already has this name, ignoring
    /// case. Checked here rather than by a unique index, which could not be
    /// created on a database that already holds duplicates.
    let private ifNameIsFree (store: IRepository<Guid, IngredientEntity>) (ingredient : Ingredient) (ct : CancellationToken) write =
        task {
            let sameName (other: IngredientEntity) =
                other.Id <> ingredient.Id
                && String.Equals(other.Name.Trim(), ingredient.Name.Trim(), StringComparison.OrdinalIgnoreCase)

            match! store.Query(sameName, ct) with
            | Error message -> return Error message
            | Ok(_ :: _) -> return Error $"An ingredient named '%s{ingredient.Name}' already exists."
            | Ok [] -> return! write ()
        }

    let add (store: IRepository<Guid, IngredientEntity>) (ingredient : Ingredient) (ct : CancellationToken) =
        ifNameIsFree store ingredient ct (fun () ->
            task {
                let! added = store.Add(Mapping.Entities.ingredient ingredient, ct)
                return added |> Result.map Mapping.Domain.ingredient
            })

    let get (store: IRepository<Guid, IngredientEntity>) (id : Guid) (ct : CancellationToken) =
        task {
            let! found = store.Get(id, ct)
            return found |> Result.map Mapping.Domain.ingredient
        }

    let update (store: IRepository<Guid, IngredientEntity>) (ingredient : Ingredient) (ct : CancellationToken) =
        ifNameIsFree store ingredient ct (fun () ->
            task {
                let! updated = store.Update(Mapping.Entities.ingredient ingredient, ct)
                return updated |> Result.map Mapping.Domain.ingredient
            })

    let delete (store: IRepository<Guid, IngredientEntity>) (id : Guid) (ct : CancellationToken) =
        store.Delete(id, ct)

    let all (store: IRepository<Guid, IngredientEntity>) (ct : CancellationToken) =
        task {
            let! found = store.All ct
            return found |> Result.map (List.map Mapping.Domain.ingredient)
        }
