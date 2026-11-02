namespace MealPlan.Core

open System
open System.Threading
open MealPlan.Core.Data

/// The week grid: which recipe sits in which meal slot on which day.
///
/// Days are stored sparsely — a row exists only once something is planned for
/// it — so `range` fills the gaps and `clearMeal` removes the row again when
/// the last slot of a day is emptied.
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

    /// Puts a recipe in a slot, creating the day if this is its first meal.
    /// A recipe id that does not exist trips the foreign key and comes back as
    /// the store's error.
    let setMeal
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
            | Ok None -> return! plans.Add({ Date = date; Meals = Map.ofList [ slot, recipeId ] }, ct)
            | Ok(Some day) -> return! plans.Update({ day with Meals = Map.add slot recipeId day.Meals }, ct)
        }

    /// Empties a slot, and drops the day once it holds nothing. Clearing a slot
    /// that is already empty succeeds — the caller asked for an end state, and
    /// that is the state.
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
            | Ok(Some day) ->
                let remaining = Map.remove slot day.Meals

                if Map.isEmpty remaining then
                    return! plans.Delete(date, ct)
                else
                    let! updated = plans.Update({ day with Meals = remaining }, ct)
                    return updated |> Result.map ignore
        }
