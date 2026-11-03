using MealPlan.Core;
using MealPlan.Core.Data;
using Microsoft.FSharp.Collections;
using Microsoft.FSharp.Core;

namespace MealPlan.Host;

// The wire contracts. These are deliberately plain C# records rather than the
// F# domain types: System.Text.Json renders an F# `option` as {"Value": ...}
// and a `Map` as something worse, and `Recipe.Reference` is an option while
// `Day.Meals` is a Map. Keeping a translation layer here means the JSON stays
// idiomatic and the domain stays free to change shape.

public record IngredientResponse(Guid Id, string Name, string Category);

public record IngredientRequest(string Name, string Category);

public record RecipeIngredientResponse(Guid IngredientId, string Name, string Category, uint Amount, string Unit);

public record RecipeIngredientRequest(Guid IngredientId, uint Amount, string Unit);

public record RecipeResponse(
    Guid Id,
    string Name,
    string[] Steps,
    RecipeIngredientResponse[] Ingredients,
    string? Reference,
    string[] Tags);

public record RecipeRequest(
    string Name,
    string[]? Steps,
    RecipeIngredientRequest[]? Ingredients,
    string? Reference,
    string[]? Tags);

/// What the planner grid needs of a recipe: enough to render a slot.
public record RecipeSummaryResponse(Guid Id, string Name, string[] Tags);

public record DayResponse(DateOnly Date, Dictionary<string, RecipeSummaryResponse[]> Meals);

public record AddMealRequest(Guid RecipeId);

public record ShoppingLineResponse(Guid IngredientId, string Name, uint Amount, string Unit);

public record ShoppingCategoryResponse(string Category, ShoppingLineResponse[] Lines);

/// Translation between the F# domain and the contracts above.
public static class Wire
{
    public static IngredientResponse Ingredient(Ingredient ingredient) =>
        new(ingredient.Id, ingredient.Name, ingredient.Category);

    public static RecipeIngredientResponse RecipeIngredient(RecipeIngredient recipeIngredient) =>
        new(recipeIngredient.Ingredient.Id,
            recipeIngredient.Ingredient.Name,
            recipeIngredient.Ingredient.Category,
            recipeIngredient.Quantity.Amount,
            IngredientUnitModule.format(recipeIngredient.Quantity.Unit));

    public static RecipeResponse Recipe(Recipe recipe) =>
        new(recipe.Id,
            recipe.Name,
            recipe.Steps.Select(Mapping.Entities.step).ToArray(),
            recipe.Ingredients.Select(RecipeIngredient).ToArray(),
            OptionModule.ToObj(recipe.Reference),
            recipe.Tags.ToArray());

    public static RecipeSummaryResponse Summary(Recipe recipe) =>
        new(recipe.Id, recipe.Name, recipe.Tags.ToArray());

    public static ShoppingLineResponse ShoppingLine(ShoppingLine line) =>
        new(line.Ingredient.Id,
            line.Ingredient.Name,
            line.Amount,
            IngredientUnitModule.format(line.Unit));

    /// Builds the domain recipe a request describes. The request carries only
    /// ingredient ids, but the domain holds whole ingredients, so the caller
    /// supplies the catalogue. An id that is not in it is reported rather than
    /// silently dropped.
    public static (Recipe? Recipe, List<Guid> Unknown) ToRecipe(
        Guid id,
        RecipeRequest request,
        IReadOnlyDictionary<Guid, Ingredient> catalogue)
    {
        var unknown = new List<Guid>();
        var ingredients = new List<RecipeIngredient>();

        foreach (var line in request.Ingredients ?? [])
        {
            if (!catalogue.TryGetValue(line.IngredientId, out var ingredient))
            {
                unknown.Add(line.IngredientId);
                continue;
            }

            // An unrecognised unit falls back to pieces; the set is closed and
            // the frontend only ever sends one of the three.
            var unit = IngredientUnitModule.parse(line.Unit);

            ingredients.Add(new RecipeIngredient(
                ingredient,
                new IngredientQuantity(
                    line.Amount,
                    OptionModule.DefaultValue(IngredientUnit.Piece, unit))));
        }

        if (unknown.Count > 0)
        {
            return (null, unknown);
        }

        var recipe = new Recipe(
            id,
            request.Name ?? string.Empty,
            ListModule.OfSeq((request.Steps ?? []).Select(Mapping.Domain.step)),
            ListModule.OfSeq(ingredients),
            OptionModule.OfObj(request.Reference),
            ListModule.OfSeq(request.Tags ?? []));

        return (recipe, unknown);
    }
}
