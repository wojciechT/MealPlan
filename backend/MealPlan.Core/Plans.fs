namespace MealPlan.Core

open System
open System.Threading
open MealPlan.Core.Data

/// The week grid: which recipes sit in which meal slot on which day. A slot
/// holds any number of recipes, in the order they were added.
///
/// Days are stored sparsely — a row exists only once something is planned for
/// it — so `range` fills the gaps and the row is removed again when the last
/// slot of a day is emptied.
module Plans =

    let private dates (from: DateOnly) (until: DateOnly) =
        if until < from then
            []
        else
            [ 0 .. until.DayNumber - from.DayNumber ] |> List.map from.AddDays

    /// Every date between `from` and `until` inclusive, planned or not.
    let range (plans: IRepository<DateOnly, DayEntity>) (from: DateOnly) (until: DateOnly) (ct: CancellationToken) =
        task {
            // `Query` filters in memory after loading everything (see
            // `IRepository.Query`); fine at the scale of one household.
            let! found = plans.Query((fun day -> day.Date >= from && day.Date <= until), ct)

            return
                found
                |> Result.map (fun days ->
                    let planned = days |> List.map (fun day -> day.Date, day) |> Map.ofList

                    dates from until
                    |> List.map (fun date ->
                        planned
                        |> Map.tryFind date
                        |> Option.defaultValue { Date = date; Meals = Map.empty }))
        }

    /// Reads the day, or an empty one when nothing is planned yet. A missing
    /// day is not an error here; it is the normal state of most dates.
    let private dayOrEmpty (plans: IRepository<DateOnly, DayEntity>) (date: DateOnly) ct =
        task {
            match! plans.Get(date, ct) with
            | Ok day -> return Ok(Some day)
            | Error _ -> return Ok None
        }

    /// Writes the day's new meals, dropping the day once it holds nothing.
    let private save (plans: IRepository<DateOnly, DayEntity>) (day: DayEntity) ct =
        task {
            if Map.isEmpty day.Meals then
                return! plans.Delete(day.Date, ct)
            else
                let! updated = plans.Update(day, ct)
                return updated |> Result.map ignore
        }

    /// Adds a recipe to a slot, after any already there, creating the day if
    /// this is its first meal. Adding a recipe the slot already holds changes
    /// nothing. A recipe id that does not exist trips the foreign key and comes
    /// back as the store's error.
    let addMeal
        (plans: IRepository<DateOnly, DayEntity>)
        (date: DateOnly)
        (mealTime: MealTime)
        (recipeId: Guid)
        (ct: CancellationToken)
        =
        task {
            let slot = Mapping.Entities.mealTime mealTime

            match! dayOrEmpty plans date ct with
            | Error message -> return Error message
            | Ok None ->
                let! added = plans.Add({ Date = date; Meals = Map.ofList [ slot, [ recipeId ] ] }, ct)
                return added |> Result.map ignore
            | Ok(Some day) ->
                let current = day.Meals |> Map.tryFind slot |> Option.defaultValue []

                if List.contains recipeId current then
                    return Ok()
                else
                    let! updated = plans.Update({ day with Meals = Map.add slot (current @ [ recipeId ]) day.Meals }, ct)
                    return updated |> Result.map ignore
        }

    /// Takes one recipe out of a slot, leaving the others. Like `clearMeal`,
    /// removing a recipe that is not there succeeds.
    let removeMeal
        (plans: IRepository<DateOnly, DayEntity>)
        (date: DateOnly)
        (mealTime: MealTime)
        (recipeId: Guid)
        (ct: CancellationToken)
        =
        task {
            let slot = Mapping.Entities.mealTime mealTime

            match! dayOrEmpty plans date ct with
            | Error message -> return Error message
            | Ok None -> return Ok()
            | Ok(Some day) ->
                match day.Meals |> Map.tryFind slot with
                | Some current when List.contains recipeId current ->
                    let meals =
                        match List.filter ((<>) recipeId) current with
                        | [] -> Map.remove slot day.Meals
                        | remaining -> Map.add slot remaining day.Meals

                    return! save plans { day with Meals = meals } ct
                | _ -> return Ok()
        }

    /// Empties a slot of every recipe, and drops the day once it holds
    /// nothing. Clearing a slot that is already empty succeeds — the caller
    /// asked for an end state, and that is the state.
    let clearMeal
        (plans: IRepository<DateOnly, DayEntity>)
        (date: DateOnly)
        (mealTime: MealTime)
        (ct: CancellationToken)
        =
        task {
            let slot = Mapping.Entities.mealTime mealTime

            match! dayOrEmpty plans date ct with
            | Error message -> return Error message
            | Ok None -> return Ok()
            | Ok(Some day) -> return! save plans { day with Meals = Map.remove slot day.Meals } ct
        }
