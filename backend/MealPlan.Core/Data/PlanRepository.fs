namespace MealPlan.Core.Data

open System
open System.Collections.Concurrent
open System.Threading.Tasks

type InMemoryPlanRepository() =

    let store = ConcurrentDictionary<DateOnly, DayEntity>()

    let notFound (date: DateOnly) = $"No plan for %O{date}."

    interface IRepository<DateOnly, DayEntity> with

        member _.Get(date, _) =
            match store.TryGetValue date with
            | true, day -> Ok day
            | _ -> Error(notFound date)
            |> Task.FromResult

        member _.Add(day, _) =
            match store.TryAdd(day.Date, day) with
            | true -> Ok day
            | false -> Error $"A plan for %O{day.Date} already exists."
            |> Task.FromResult

        member _.Update(day, _) =
            match store.TryGetValue day.Date with
            | true, existing when store.TryUpdate(day.Date, day, existing) -> Ok day
            | true, _ -> Error $"The plan for %O{day.Date} was changed by someone else."
            | _ -> Error(notFound day.Date)
            |> Task.FromResult

        member _.Delete(date, _) =
            match store.TryRemove date with
            | true, _ -> Ok()
            | _ -> Error(notFound date)
            |> Task.FromResult

        member _.All(_) = store.Values |> List.ofSeq |> Ok |> Task.FromResult

        member _.Query(predicate, _) =
            store.Values |> Seq.filter predicate |> List.ofSeq |> Ok |> Task.FromResult
