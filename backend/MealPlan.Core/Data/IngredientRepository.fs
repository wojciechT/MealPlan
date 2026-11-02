namespace MealPlan.Core.Data

open System
open System.Collections.Concurrent
open System.Threading.Tasks

type InMemoryIngredientRepository() =

    let store = ConcurrentDictionary<Guid, IngredientEntity>()

    let notFound (id: Guid) = $"No ingredient with id %O{id}."

    interface IRepository<Guid, IngredientEntity> with

        member _.Get(id, _) =
            match store.TryGetValue id with
            | true, ingredient -> Ok ingredient
            | _ -> Error(notFound id)
            |> Task.FromResult

        member _.Add(ingredient, _) =
            match store.TryAdd(ingredient.Id, ingredient) with
            | true -> Ok ingredient
            | false -> Error $"An ingredient with id %O{ingredient.Id} already exists."
            |> Task.FromResult

        member _.Update(ingredient, _) =
            match store.TryGetValue ingredient.Id with
            | true, existing when store.TryUpdate(ingredient.Id, ingredient, existing) -> Ok ingredient
            | true, _ -> Error $"Ingredient %O{ingredient.Id} was changed by someone else."
            | _ -> Error(notFound ingredient.Id)
            |> Task.FromResult

        member _.Delete(id, _) =
            match store.TryRemove id with
            | true, _ -> Ok()
            | _ -> Error(notFound id)
            |> Task.FromResult

        member _.All(_) = store.Values |> List.ofSeq |> Ok |> Task.FromResult

        member _.Query(predicate, _) =
            store.Values |> Seq.filter predicate |> List.ofSeq |> Ok |> Task.FromResult
