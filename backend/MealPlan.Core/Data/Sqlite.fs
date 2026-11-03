namespace MealPlan.Core.Data

open System
open System.Data.Common
open System.Threading
open System.Threading.Tasks
open Microsoft.Data.Sqlite

/// Plumbing shared by the SQLite-backed repositories: the schema, connections,
/// parameter binding, and the text encodings for the entity enums.
///
/// Everything here is task-returning and takes a cancellation token. Note that
/// Microsoft.Data.Sqlite runs the `*Async` methods synchronously — SQLite is a
/// local file, so there is no I/O to await. The shape is for the callers'
/// benefit, and for the day the store is something remote.
module Sqlite =

    [<Literal>]
    let schema =
        """
        CREATE TABLE IF NOT EXISTS ingredients (
            id       TEXT PRIMARY KEY,
            name     TEXT NOT NULL,
            category TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS recipes (
            id        TEXT PRIMARY KEY,
            name      TEXT NOT NULL,
            reference TEXT NULL
        );

        CREATE TABLE IF NOT EXISTS recipe_steps (
            recipe_id TEXT    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
            ordinal   INTEGER NOT NULL,
            text      TEXT    NOT NULL,
            PRIMARY KEY (recipe_id, ordinal)
        );

        CREATE TABLE IF NOT EXISTS recipe_ingredients (
            recipe_id     TEXT    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
            ingredient_id TEXT    NOT NULL REFERENCES ingredients(id),
            ordinal       INTEGER NOT NULL,
            amount        INTEGER NOT NULL,
            unit          TEXT    NOT NULL,
            PRIMARY KEY (recipe_id, ingredient_id)
        );

        CREATE TABLE IF NOT EXISTS recipe_tags (
            recipe_id TEXT    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
            tag       TEXT    NOT NULL,
            ordinal   INTEGER NOT NULL,
            PRIMARY KEY (recipe_id, tag)
        );

        CREATE TABLE IF NOT EXISTS days (
            date TEXT PRIMARY KEY
        );

        CREATE TABLE IF NOT EXISTS day_meals (
            date      TEXT    NOT NULL REFERENCES days(date) ON DELETE CASCADE,
            meal_time TEXT    NOT NULL,
            recipe_id TEXT    NOT NULL REFERENCES recipes(id),
            ordinal   INTEGER NOT NULL,
            PRIMARY KEY (date, meal_time, recipe_id)
        );
        """

    /// Databases created when a slot held a single recipe have `day_meals`
    /// keyed by (date, meal_time) and no `ordinal`. The key cannot be altered
    /// in place, so the table is rebuilt and each old meal becomes the first
    /// (and only) recipe of its slot.
    [<Literal>]
    let private multiRecipeMeals =
        """
        ALTER TABLE day_meals RENAME TO day_meals_single;

        CREATE TABLE day_meals (
            date      TEXT    NOT NULL REFERENCES days(date) ON DELETE CASCADE,
            meal_time TEXT    NOT NULL,
            recipe_id TEXT    NOT NULL REFERENCES recipes(id),
            ordinal   INTEGER NOT NULL,
            PRIMARY KEY (date, meal_time, recipe_id)
        );

        INSERT INTO day_meals (date, meal_time, recipe_id, ordinal)
        SELECT date, meal_time, recipe_id, 0 FROM day_meals_single;

        DROP TABLE day_meals_single;
        """

    /// SQLite's constraint-violation result code, raised by a duplicate primary
    /// key or a reference to a row that is not there.
    [<Literal>]
    let constraintError = 19

    let private execute (conn: SqliteConnection) (ct: CancellationToken) (sql: string) =
        task {
            use cmd = conn.CreateCommand()
            cmd.CommandText <- sql
            let! _ = cmd.ExecuteNonQueryAsync ct
            return ()
        }

    /// Opens a connection with foreign keys enforced; they are off by default
    /// and the setting is per-connection, not per-database.
    let connect (connectionString: string) (ct: CancellationToken) =
        task {
            let conn = new SqliteConnection(connectionString)
            do! conn.OpenAsync ct
            do! execute conn ct "PRAGMA foreign_keys = ON;"
            return conn
        }

    /// Creates any missing tables. Safe to call on every start-up.
    let migrate (connectionString: string) (ct: CancellationToken) =
        task {
            use! conn = connect connectionString ct
            do! execute conn ct schema

            let! hasOrdinal =
                task {
                    use cmd = conn.CreateCommand()
                    cmd.CommandText <- "SELECT 1 FROM pragma_table_info('day_meals') WHERE name = 'ordinal'"
                    let! found = cmd.ExecuteScalarAsync ct
                    return not (isNull found)
                }

            if not hasOrdinal then
                let! transaction = conn.BeginTransactionAsync ct
                use tx = transaction :?> SqliteTransaction
                use cmd = conn.CreateCommand()
                cmd.CommandText <- multiRecipeMeals
                cmd.Transaction <- tx
                let! _ = cmd.ExecuteNonQueryAsync ct
                do! tx.CommitAsync ct
        }

    let command (conn: SqliteConnection) (tx: SqliteTransaction) (sql: string) (parameters: (string * obj) list) =
        let cmd = conn.CreateCommand()
        cmd.CommandText <- sql
        cmd.Transaction <- tx

        for name, value in parameters do
            cmd.Parameters.AddWithValue(name, if isNull value then box DBNull.Value else value)
            |> ignore

        cmd

    /// Reads every row the command returns.
    let rows (cmd: SqliteCommand) (ct: CancellationToken) (read: DbDataReader -> 'T) =
        task {
            use! reader = cmd.ExecuteReaderAsync ct
            let items = ResizeArray()
            let mutable go = true

            while go do
                match! reader.ReadAsync ct with
                | true -> items.Add(read reader)
                | false -> go <- false

            return List.ofSeq items
        }

    /// Reads the first row, if there is one.
    let firstRow (cmd: SqliteCommand) (ct: CancellationToken) (read: DbDataReader -> 'T) =
        task {
            use! reader = cmd.ExecuteReaderAsync ct

            match! reader.ReadAsync ct with
            | true -> return Some(read reader)
            | false -> return None
        }

    let guid (id: Guid) = box (id.ToString "D")

    let date (d: DateOnly) = box (d.ToString("yyyy-MM-dd", Globalization.CultureInfo.InvariantCulture))

    let optional (value: string option) = value |> Option.map box |> Option.defaultValue null

    let readGuid (reader: DbDataReader) (ordinal: int) = Guid.Parse(reader.GetString ordinal)

    let readDate (reader: DbDataReader) (ordinal: int) =
        DateOnly.Parse(reader.GetString ordinal, Globalization.CultureInfo.InvariantCulture)

    let readOptional (reader: DbDataReader) (ordinal: int) =
        if reader.IsDBNull ordinal then None else Some(reader.GetString ordinal)

    // The enums are stored as text rather than their numeric values: the
    // database stays readable, and renumbering the enum cannot silently
    // re-interpret existing rows.
    let mealTimeText (mealTime: MealTimeEntity) =
        match mealTime with
        | MealTimeEntity.Breakfast -> "breakfast"
        | MealTimeEntity.Lunch -> "lunch"
        | MealTimeEntity.Dinner -> "dinner"
        | MealTimeEntity.Supper -> "supper"
        | other -> raise (FormatException $"%A{other} is not a meal time.")

    let readMealTime (reader: DbDataReader) (ordinal: int) =
        match reader.GetString ordinal with
        | "breakfast" -> MealTimeEntity.Breakfast
        | "lunch" -> MealTimeEntity.Lunch
        | "dinner" -> MealTimeEntity.Dinner
        | "supper" -> MealTimeEntity.Supper
        | other -> raise (FormatException $"'%s{other}' is not a meal time.")

    let unitText (unit: IngredientUnitEntity) =
        match unit with
        | IngredientUnitEntity.Piece -> "piece"
        | IngredientUnitEntity.Gram -> "gram"
        | IngredientUnitEntity.Ml -> "ml"
        | other -> raise (FormatException $"%A{other} is not an ingredient unit.")

    let readUnit (reader: DbDataReader) (ordinal: int) =
        match reader.GetString ordinal with
        | "piece" -> IngredientUnitEntity.Piece
        | "gram" -> IngredientUnitEntity.Gram
        | "ml" -> IngredientUnitEntity.Ml
        | other -> raise (FormatException $"'%s{other}' is not an ingredient unit.")

    /// Runs a unit of work in a transaction, turning the SQLite failures the
    /// repositories cannot prevent into the `Error` side of the result. A
    /// cancellation is left to propagate as an exception.
    let transact
        (connectionString: string)
        (ct: CancellationToken)
        (work: SqliteConnection -> SqliteTransaction -> Task<Result<'T, string>>)
        =
        task {
            try
                use! conn = connect connectionString ct
                let! transaction = conn.BeginTransactionAsync ct
                use tx = transaction :?> SqliteTransaction

                match! work conn tx with
                | Ok value ->
                    do! tx.CommitAsync ct
                    return Ok value
                | Error message ->
                    do! tx.RollbackAsync ct
                    return Error message
            with
            | :? SqliteException as ex -> return Error ex.Message
            | :? FormatException as ex -> return Error ex.Message
        }
