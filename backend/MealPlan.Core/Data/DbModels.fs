namespace MealPlan.Core.Data

open System

type MealTimeEntity =
    | Breakfast = 0
    | Lunch = 1
    | Dinner = 2
    | Supper = 3

type IngredientUnitEntity =
    | Piece = 0
    | Gram = 1
    | Ml = 2

type IngredientQuantityEntity = { Amount : uint; Unit: IngredientUnitEntity }

type IngredientEntity = { Id: Guid; Name : string; Category: string }

type RecipeIngredientEntity = { Ingredient : Guid; Quantity: IngredientQuantityEntity }

type RecipeEntity = { Id: Guid; Name: string; Steps: string list; Ingredients : RecipeIngredientEntity list; Reference: string option; Tags: string list }

type DayEntity = { Date: DateOnly; Meals: Map<MealTimeEntity, Guid> }

type MealPlanKeyEntity = {Date: DateOnly; Time: MealTimeEntity}
