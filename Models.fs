namespace MealPlan
open System

type MealTime = Breakfast | Lunch | Dinner | Supper

type IngredientUnit = Piece | Gram | Ml

type IngredientQuantity = { Amount : uint; Unit: IngredientUnit }

type RecipeIngredient = { Ingredient : string; Quantity: IngredientQuantity }

type RecipeStep =  Step of string

type Recipe = { Steps: RecipeStep list; Ingredients : RecipeIngredient list; Reference: string option; Tags: string list }

type Day = { Date: DateOnly; Meals: Map<MealTime, Recipe> }
