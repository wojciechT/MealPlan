namespace MealPlan.Core.Data

open System
open System.Threading
open Microsoft.Data.Sqlite

type SqlitePlanRepository(connectionString: string) =

    let notFound (date: DateOnly) = $"No plan for %O{date}."

    let exists conn tx ct (date: DateOnly) =
        task {
            use cmd = Sqlite.command conn tx "SELECT 1 FROM days WHERE date = $date" [ "$date", Sqlite.date date ]

            let! row = Sqlite.firstRow cmd ct ignore
            return Option.isSome row
        }

    /// Groups (meal time, recipe) rows into slots, keeping the rows' order.
    let slots (rows: (MealTimeEntity * Guid) list) =
        rows
        |> List.groupBy fst
        |> List.map (fun (mealTime, recipes) -> mealTime, recipes |> List.map snd)
        |> Map.ofList

    let readMeals conn tx ct (date: DateOnly) =
        task {
            use cmd =
                Sqlite.command
                    conn
                    tx
                    "SELECT meal_time, recipe_id FROM day_meals WHERE date = $date ORDER BY ordinal"
                    [ "$date", Sqlite.date date ]

            let! meals = Sqlite.rows cmd ct (fun reader -> Sqlite.readMealTime reader 0, Sqlite.readGuid reader 1)
            return slots meals
        }

    /// Loads every plan with two queries rather than one per day.
    let readAll ct =
        Sqlite.transact connectionString ct (fun conn tx ->
            task {
                let! meals =
                    use cmd =
                        Sqlite.command conn tx "SELECT date, meal_time, recipe_id FROM day_meals ORDER BY ordinal" []

                    Sqlite.rows cmd ct (fun reader ->
                        Sqlite.readDate reader 0, (Sqlite.readMealTime reader 1, Sqlite.readGuid reader 2))

                let meals =
                    meals
                    |> List.groupBy fst
                    |> List.map (fun (date, rows) -> date, rows |> List.map snd |> slots)
                    |> Map.ofList

                use cmd = Sqlite.command conn tx "SELECT date FROM days ORDER BY date" []

                let! days =
                    Sqlite.rows cmd ct (fun reader ->
                        let date = Sqlite.readDate reader 0

                        { Date = date
                          Meals = meals |> Map.tryFind date |> Option.defaultValue Map.empty })

                return Ok days
            })

    let writeMeals conn tx ct (day: DayEntity) =
        task {
            for KeyValue(mealTime, recipeIds) in day.Meals do
                for ordinal, recipeId in List.indexed recipeIds do
                    use cmd =
                        Sqlite.command
                            conn
                            tx
                            "INSERT INTO day_meals (date, meal_time, recipe_id, ordinal) VALUES ($date, $meal_time, $recipe_id, $ordinal)"
                            [ "$date", Sqlite.date day.Date
                              "$meal_time", box (Sqlite.mealTimeText mealTime)
                              "$recipe_id", Sqlite.guid recipeId
                              "$ordinal", box ordinal ]

                    let! _ = cmd.ExecuteNonQueryAsync ct
                    ()
        }

    interface IRepository<DateOnly, DayEntity> with

        member _.Get(date, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    match! exists conn tx ct date with
                    | false -> return Error(notFound date)
                    | true ->
                        let! meals = readMeals conn tx ct date
                        return Ok { Date = date; Meals = meals }
                })

        member _.Add(day, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    // Only the days row is guarded here: a constraint failure on a meal
                    // means a missing recipe, not a duplicate plan.
                    let insertDay () =
                        task {
                            use cmd =
                                Sqlite.command conn tx "INSERT INTO days (date) VALUES ($date)" [ "$date", Sqlite.date day.Date ]

                            try
                                let! _ = cmd.ExecuteNonQueryAsync ct
                                return Ok()
                            with :? SqliteException as ex when ex.SqliteErrorCode = Sqlite.constraintError ->
                                return Error $"A plan for %O{day.Date} already exists."
                        }

                    match! insertDay () with
                    | Error message -> return Error message
                    | Ok() ->
                        do! writeMeals conn tx ct day
                        return Ok day
                })

        member _.Update(day, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    match! exists conn tx ct day.Date with
                    | false -> return Error(notFound day.Date)
                    | true ->
                        use cmd =
                            Sqlite.command conn tx "DELETE FROM day_meals WHERE date = $date" [ "$date", Sqlite.date day.Date ]

                        let! _ = cmd.ExecuteNonQueryAsync ct
                        do! writeMeals conn tx ct day
                        return Ok day
                })

        member _.Delete(date, ct) =
            Sqlite.transact connectionString ct (fun conn tx ->
                task {
                    use cmd = Sqlite.command conn tx "DELETE FROM days WHERE date = $date" [ "$date", Sqlite.date date ]

                    match! cmd.ExecuteNonQueryAsync ct with
                    | 0 -> return Error(notFound date)
                    | _ -> return Ok()
                })

        member _.All(ct) = readAll ct

        member _.Query(predicate, ct) =
            task {
                let! all = readAll ct
                return all |> Result.map (List.filter predicate)
            }
