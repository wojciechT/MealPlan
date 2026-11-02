using MealPlan.Core;
using MealPlan.Core.Data;

namespace MealPlan.Host.Endpoints;

public static class RecipeEndpoints
{
    /// The domain holds whole ingredients where a request holds ids, so every
    /// write needs the catalogue to hand.
    internal static async Task<(Dictionary<Guid, Ingredient>? Catalogue, IResult? Failure)> LoadCatalogue(
        IRepository<Guid, IngredientEntity> ingredients,
        CancellationToken ct)
    {
        var result = await Ingredients.all(ingredients, ct);

        return result.IsOk
            ? (result.ResultValue.ToDictionary(i => i.Id), null)
            : (null, ApiResults.Classify(result.ErrorValue));
    }

    public static RouteGroupBuilder MapRecipeEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/recipes").WithTags("Recipes");

        group.MapGet("/", async (
            string? search,
            string? tag,
            IRepository<Guid, RecipeEntity> recipes,
            IRepository<Guid, IngredientEntity> ingredients,
            CancellationToken ct) =>
        {
            var result = await Recipes.all(recipes, ingredients, ct);

            return ApiResults.FromRecipe(result, found =>
            {
                var matches = found.AsEnumerable();

                if (!string.IsNullOrWhiteSpace(search))
                {
                    matches = matches.Where(r =>
                        r.Name.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase));
                }

                if (!string.IsNullOrWhiteSpace(tag))
                {
                    matches = matches.Where(r =>
                        r.Tags.Any(t => string.Equals(t, tag.Trim(), StringComparison.OrdinalIgnoreCase)));
                }

                return Results.Ok(matches
                    .OrderBy(r => r.Name, StringComparer.CurrentCultureIgnoreCase)
                    .Select(Wire.Recipe)
                    .ToArray());
            });
        })
        .WithName("GetRecipes");

        group.MapGet("/{id:guid}", async (
            Guid id,
            IRepository<Guid, RecipeEntity> recipes,
            IRepository<Guid, IngredientEntity> ingredients,
            CancellationToken ct) =>
        {
            var result = await Recipes.get(recipes, ingredients, id, ct);

            return ApiResults.FromRecipe(result, found => Results.Ok(Wire.Recipe(found)));
        })
        .WithName("GetRecipe");

        group.MapPost("/", async (
            RecipeRequest request,
            IRepository<Guid, RecipeEntity> recipes,
            IRepository<Guid, IngredientEntity> ingredients,
            CancellationToken ct) =>
        {
            var (catalogue, failure) = await LoadCatalogue(ingredients, ct);

            if (catalogue is null)
            {
                return failure!;
            }

            var (recipe, unknown) = Wire.ToRecipe(Guid.NewGuid(), request, catalogue);

            if (recipe is null)
            {
                return ApiResults.Invalid(
                    unknown.Select(id => $"No ingredient with id {id}."),
                    "The recipe is not valid.");
            }

            var result = await Recipes.add(recipes, recipe, ct);

            return ApiResults.FromRecipe(result, added =>
                Results.Created($"/api/recipes/{added.Id}", Wire.Recipe(added)));
        })
        .WithName("AddRecipe");

        group.MapPut("/{id:guid}", async (
            Guid id,
            RecipeRequest request,
            IRepository<Guid, RecipeEntity> recipes,
            IRepository<Guid, IngredientEntity> ingredients,
            CancellationToken ct) =>
        {
            var (catalogue, failure) = await LoadCatalogue(ingredients, ct);

            if (catalogue is null)
            {
                return failure!;
            }

            var (recipe, unknown) = Wire.ToRecipe(id, request, catalogue);

            if (recipe is null)
            {
                return ApiResults.Invalid(
                    unknown.Select(missing => $"No ingredient with id {missing}."),
                    "The recipe is not valid.");
            }

            var result = await Recipes.update(recipes, recipe, ct);

            return ApiResults.FromRecipe(result, updated => Results.Ok(Wire.Recipe(updated)));
        })
        .WithName("UpdateRecipe");

        group.MapDelete("/{id:guid}", async (
            Guid id,
            IRepository<Guid, RecipeEntity> recipes,
            CancellationToken ct) =>
        {
            // A recipe still on the plan trips the foreign key on day_meals.
            var result = await Recipes.delete(recipes, id, ct);

            return ApiResults.FromRecipe(result, _ => Results.NoContent(), ForeignKey.StillInUse);
        })
        .WithName("DeleteRecipe");

        return api;
    }
}
