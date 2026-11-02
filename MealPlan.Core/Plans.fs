namespace MealPlan.Core

open System
open System.Collections.Concurrent

module Plans =
    let planStore = ConcurrentDictionary<MealPlanKey, Guid>()
    
    let add (date : DateOnly) (mealTime : MealTime) (recipeId : Guid) =
        { Date = date; Time = mealTime }
        |> fun k -> planStore.AddOrUpdate (k, recipeId, fun _ __ -> recipeId)