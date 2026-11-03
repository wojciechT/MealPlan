namespace MealPlan.Core

open System

type MealTime = Breakfast | Lunch | Dinner | Supper

type IngredientUnit = Piece | Gram | Ml

type IngredientQuantity = { Amount : uint; Unit: IngredientUnit }

type Ingredient = { Id: Guid; Name : string; Category: string }

type RecipeIngredient = { Ingredient : Ingredient; Quantity: IngredientQuantity }

type RecipeStep =  Step of string

type Recipe = { Id: Guid; Name: string; Steps: RecipeStep list; Ingredients : RecipeIngredient list; Reference: string option; Tags: string list }

type Day = { Date: DateOnly; Meals: Map<MealTime, Recipe list> }

type MealPlanKey = {Date: DateOnly; Time: MealTime}

/// The wire vocabulary for a meal time. Deliberately the same words the
/// database stores (see `Sqlite.mealTimeText`), so a URL, a JSON field and a
/// row all read alike.
module MealTime =

    let all = [ Breakfast; Lunch; Dinner; Supper ]

    let format mealTime =
        match mealTime with
        | Breakfast -> "breakfast"
        | Lunch -> "lunch"
        | Dinner -> "dinner"
        | Supper -> "supper"

    let parse (text: string) =
        match (if isNull text then "" else text.Trim().ToLowerInvariant()) with
        | "breakfast" -> Some Breakfast
        | "lunch" -> Some Lunch
        | "dinner" -> Some Dinner
        | "supper" -> Some Supper
        | _ -> None

/// The wire vocabulary for an ingredient unit, matching `Sqlite.unitText`.
module IngredientUnit =

    let all = [ Piece; Gram; Ml ]

    let format unit =
        match unit with
        | Piece -> "piece"
        | Gram -> "gram"
        | Ml -> "ml"

    let parse (text: string) =
        match (if isNull text then "" else text.Trim().ToLowerInvariant()) with
        | "piece" -> Some Piece
        | "gram" -> Some Gram
        | "ml" -> Some Ml
        | _ -> None
