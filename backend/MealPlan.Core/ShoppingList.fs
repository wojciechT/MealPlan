namespace MealPlan.Core

/// One line of the list: everything a date range needs of one ingredient, in
/// one unit.
type ShoppingLine =
    { Ingredient: Ingredient
      Amount: uint
      Unit: IngredientUnit }

/// Rolls planned recipes up into something you can shop from.
///
/// Pure, and deliberately so — the interesting behaviour is the grouping, and
/// it is worth being able to test it without a database.
module ShoppingList =

    /// Sums quantities per ingredient *and unit*: 200g of tomatoes and 2
    /// tomatoes are two different things to buy, so they stay two lines.
    /// A recipe appearing twice in the week is counted twice, which is the
    /// point.
    let ofRecipes (recipes: Recipe list) : ShoppingLine list =
        recipes
        |> List.collect _.Ingredients
        |> List.groupBy (fun i -> i.Ingredient.Id, i.Quantity.Unit)
        |> List.map (fun ((_, unit), entries) ->
            { Ingredient = (List.head entries).Ingredient
              Amount = entries |> List.sumBy _.Quantity.Amount
              Unit = unit })
        |> List.sortBy (fun line ->
            line.Ingredient.Category.ToLowerInvariant(),
            line.Ingredient.Name.ToLowerInvariant(),
            IngredientUnit.format line.Unit)

    /// The same lines, bucketed by category and ready to render as sections.
    /// Categories come out in the order `ofRecipes` sorted them.
    let byCategory (lines: ShoppingLine list) =
        lines |> List.groupBy _.Ingredient.Category
