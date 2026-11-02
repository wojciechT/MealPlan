namespace MealPlan.Core

open System

type MealTime = Breakfast | Lunch | Dinner | Supper

type IngredientUnit = Piece | Gram | Ml

type IngredientQuantity = { Amount : uint; Unit: IngredientUnit }

type Ingredient = { Id: Guid; Name : string; Category: string }

type RecipeIngredient = { Ingredient : Ingredient; Quantity: IngredientQuantity }

type RecipeStep =  Step of string

type Recipe = { Id: Guid; Name: string; Steps: RecipeStep list; Ingredients : RecipeIngredient list; Reference: string option; Tags: string list }

type Day = { Date: DateOnly; Meals: Map<MealTime, Recipe> }

type MealPlanKey = {Date: DateOnly; Time: MealTime}
