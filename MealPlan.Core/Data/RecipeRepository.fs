namespace MealPlan.Core.Data

open System
open System.Collections.Concurrent
open System.Threading.Tasks

type InMemoryRecipeRepository() =

    let store = ConcurrentDictionary<Guid, RecipeEntity>()

    let notFound (id: Guid) = $"No recipe with id %O{id}."

    interface IRepository<Guid, RecipeEntity> with

        member _.Get(id, _) =
            match store.TryGetValue id with
            | true, recipe -> Ok recipe
            | _ -> Error(notFound id)
            |> Task.FromResult

        member _.Add(recipe, _) =
            match store.TryAdd(recipe.Id, recipe) with
            | true -> Ok recipe
            | false -> Error $"A recipe with id %O{recipe.Id} already exists."
            |> Task.FromResult

        member _.Update(recipe, _) =
            match store.TryGetValue recipe.Id with
            | true, existing when store.TryUpdate(recipe.Id, recipe, existing) -> Ok recipe
            | true, _ -> Error $"Recipe %O{recipe.Id} was changed by someone else."
            | _ -> Error(notFound recipe.Id)
            |> Task.FromResult

        member _.Delete(id, _) =
            match store.TryRemove id with
            | true, _ -> Ok()
            | _ -> Error(notFound id)
            |> Task.FromResult

        member _.All(_) = store.Values |> List.ofSeq |> Ok |> Task.FromResult

        member _.Query(predicate, _) =
            store.Values |> Seq.filter predicate |> List.ofSeq |> Ok |> Task.FromResult
