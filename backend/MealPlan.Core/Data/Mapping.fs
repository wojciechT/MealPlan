namespace MealPlan.Core.Data

open MealPlan.Core

/// Converts between the domain models and the entities the repositories store.
///
/// Going out is a straight projection. Coming back is not: an entity holds ids
/// where the domain holds whole records, so the `Domain` functions take a
/// resolver — `repository.Get` — and return a `Result` that carries the
/// repository's own message when a referenced row is missing.
module Mapping =

    /// `List.map` for functions that can fail, keeping the first error.
    let private traverse map items =
        (Ok [], items)
        ||> List.fold (fun state item ->
            match state, map item with
            | Ok mapped, Ok value -> Ok(value :: mapped)
            | Error message, _
            | _, Error message -> Error message)
        |> Result.map List.rev

    /// Domain to entity.
    module Entities =

        let mealTime (value: MealTime) =
            match value with
            | MealTime.Breakfast -> MealTimeEntity.Breakfast
            | MealTime.Lunch -> MealTimeEntity.Lunch
            | MealTime.Dinner -> MealTimeEntity.Dinner
            | MealTime.Supper -> MealTimeEntity.Supper

        let ingredientUnit (value: IngredientUnit) =
            match value with
            | IngredientUnit.Piece -> IngredientUnitEntity.Piece
            | IngredientUnit.Gram -> IngredientUnitEntity.Gram
            | IngredientUnit.Ml -> IngredientUnitEntity.Ml

        let quantity (value: IngredientQuantity) : IngredientQuantityEntity =
            { Amount = value.Amount
              Unit = ingredientUnit value.Unit }

        let ingredient (value: Ingredient) : IngredientEntity =
            { Id = value.Id
              Name = value.Name
              Category = value.Category }

        let step (value: RecipeStep) =
            match value with
            | RecipeStep.Step text -> text

        /// The ingredient itself is stored separately; the recipe keeps its id.
        let recipeIngredient (value: RecipeIngredient) : RecipeIngredientEntity =
            { Ingredient = value.Ingredient.Id
              Quantity = quantity value.Quantity }

        let recipe (value: Recipe) : RecipeEntity =
            { Id = value.Id
              Name = value.Name
              Steps = value.Steps |> List.map step
              Ingredients = value.Ingredients |> List.map recipeIngredient
              Reference = value.Reference
              Tags = value.Tags }

        let day (value: Day) : DayEntity =
            { Date = value.Date
              Meals =
                value.Meals
                |> Seq.map (fun (KeyValue(time, recipes)) -> mealTime time, recipes |> List.map _.Id)
                |> Map.ofSeq }

        let mealPlanKey (value: MealPlanKey) : MealPlanKeyEntity =
            { Date = value.Date; Time = mealTime value.Time }

    /// Entity to domain.
    module Domain =

        // An enum is just a number, so unlike the unions these matches need a
        // fall-through for a value outside the declared set.
        let mealTime (value: MealTimeEntity) =
            match value with
            | MealTimeEntity.Breakfast -> MealTime.Breakfast
            | MealTimeEntity.Lunch -> MealTime.Lunch
            | MealTimeEntity.Dinner -> MealTime.Dinner
            | MealTimeEntity.Supper -> MealTime.Supper
            | other -> invalidArg (nameof value) $"%A{other} is not a meal time."

        let ingredientUnit (value: IngredientUnitEntity) =
            match value with
            | IngredientUnitEntity.Piece -> IngredientUnit.Piece
            | IngredientUnitEntity.Gram -> IngredientUnit.Gram
            | IngredientUnitEntity.Ml -> IngredientUnit.Ml
            | other -> invalidArg (nameof value) $"%A{other} is not an ingredient unit."

        let quantity (value: IngredientQuantityEntity) : IngredientQuantity =
            { Amount = value.Amount
              Unit = ingredientUnit value.Unit }

        let ingredient (value: IngredientEntity) : Ingredient =
            { Id = value.Id
              Name = value.Name
              Category = value.Category }

        let step (value: string) = RecipeStep.Step value

        /// `resolveIngredient` is an ingredient repository's `Get`.
        let recipeIngredient resolveIngredient (value: RecipeIngredientEntity) : Result<RecipeIngredient, string> =
            resolveIngredient value.Ingredient
            |> Result.map (fun found ->
                { Ingredient = ingredient found
                  Quantity = quantity value.Quantity })

        let recipe resolveIngredient (value: RecipeEntity) : Result<Recipe, string> =
            value.Ingredients
            |> traverse (recipeIngredient resolveIngredient)
            |> Result.map (fun ingredients ->
                { Id = value.Id
                  Name = value.Name
                  Steps = value.Steps |> List.map step
                  Ingredients = ingredients
                  Reference = value.Reference
                  Tags = value.Tags })

        /// Needs both resolvers: a day holds recipe ids, and those recipes hold
        /// ingredient ids in turn.
        let day resolveRecipe resolveIngredient (value: DayEntity) : Result<Day, string> =
            value.Meals
            |> Seq.map (fun (KeyValue(time, recipeIds)) -> time, recipeIds)
            |> List.ofSeq
            |> traverse (fun (time, recipeIds) ->
                recipeIds
                |> traverse (fun recipeId -> resolveRecipe recipeId |> Result.bind (recipe resolveIngredient))
                |> Result.map (fun found -> mealTime time, found))
            |> Result.map (fun meals -> { Date = value.Date; Meals = Map.ofList meals })

        let mealPlanKey (value: MealPlanKeyEntity) : MealPlanKey =
            { Date = value.Date; Time = mealTime value.Time }
