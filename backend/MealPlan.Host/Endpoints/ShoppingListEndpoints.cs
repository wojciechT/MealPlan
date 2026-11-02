using MealPlan.Core;
using MealPlan.Core.Data;
using Microsoft.FSharp.Collections;

namespace MealPlan.Host.Endpoints;

public static class ShoppingListEndpoints
{
    public static RouteGroupBuilder MapShoppingListEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/shopping-list", async (
            DateOnly? from,
            DateOnly? to,
            IRepository<DateOnly, DayEntity> plans,
            IRepository<Guid, RecipeEntity> recipes,
            IRepository<Guid, IngredientEntity> ingredients,
            CancellationToken ct) =>
        {
            if (from is null || to is null)
            {
                return ApiResults.Invalid(["'from' and 'to' are required, as yyyy-MM-dd dates."]);
            }

            if (to < from)
            {
                return ApiResults.Invalid(["'to' falls before 'from'."]);
            }

            var days = await Plans.range(plans, from.Value, to.Value, ct);

            if (!days.IsOk)
            {
                return ApiResults.Classify(days.ErrorValue);
            }

            var planned = await Recipes.all(recipes, ingredients, ct);

            return ApiResults.FromRecipe(planned, known =>
            {
                var byId = known.ToDictionary(r => r.Id);

                // Multiplicity matters: the same recipe twice in the week means
                // buying for it twice.
                var cooked = days.ResultValue
                    .SelectMany(day => day.Meals.Select(slot => slot.Value))
                    .Select(id => byId.TryGetValue(id, out var recipe) ? recipe : null)
                    .Where(recipe => recipe is not null)
                    .Select(recipe => recipe!);

                var lines = ShoppingList.ofRecipes(ListModule.OfSeq(cooked));

                var categories = ShoppingList
                    .byCategory(lines)
                    .Select(group => new ShoppingCategoryResponse(
                        group.Item1,
                        group.Item2.Select(Wire.ShoppingLine).ToArray()))
                    .ToArray();

                return Results.Ok(categories);
            });
        })
        .WithName("GetShoppingList")
        .WithTags("Shopping list");

        return api;
    }
}
