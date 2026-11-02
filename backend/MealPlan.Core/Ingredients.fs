namespace MealPlan.Core

open System
open System.Threading
open MealPlan.Core.Data

module Ingredients =
    let add (store: IRepository<Guid, IngredientEntity>) (ingredient : Ingredient) (ct : CancellationToken) =
        task {
            let! added = store.Add(Mapping.Entities.ingredient ingredient, ct)
            return added |> Result.map Mapping.Domain.ingredient
        }

    let get (store: IRepository<Guid, IngredientEntity>) (id : Guid) (ct : CancellationToken) =
        task {
            let! found = store.Get(id, ct)
            return found |> Result.map Mapping.Domain.ingredient
        }

    let update (store: IRepository<Guid, IngredientEntity>) (ingredient : Ingredient) (ct : CancellationToken) =
        task {
            let! updated = store.Update(Mapping.Entities.ingredient ingredient, ct)
            return updated |> Result.map Mapping.Domain.ingredient
        }

    let delete (store: IRepository<Guid, IngredientEntity>) (id : Guid) (ct : CancellationToken) =
        store.Delete(id, ct)

    let all (store: IRepository<Guid, IngredientEntity>) (ct : CancellationToken) =
        task {
            let! found = store.All ct
            return found |> Result.map (List.map Mapping.Domain.ingredient)
        }
