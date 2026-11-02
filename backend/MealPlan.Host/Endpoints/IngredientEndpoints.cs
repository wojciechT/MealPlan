using MealPlan.Core;
using MealPlan.Core.Data;

namespace MealPlan.Host.Endpoints;

public static class IngredientEndpoints
{
    public static RouteGroupBuilder MapIngredientEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/ingredients").WithTags("Ingredients");

        group.MapGet("/", async (
            IRepository<Guid, IngredientEntity> store,
            CancellationToken ct) =>
        {
            var result = await Ingredients.all(store, ct);

            return ApiResults.FromRepository(result, found =>
                Results.Ok(found.Select(Wire.Ingredient).ToArray()));
        })
        .WithName("GetIngredients");

        group.MapGet("/{id:guid}", async (
            Guid id,
            IRepository<Guid, IngredientEntity> store,
            CancellationToken ct) =>
        {
            var result = await Ingredients.get(store, id, ct);

            return ApiResults.FromRepository(result, found => Results.Ok(Wire.Ingredient(found)));
        })
        .WithName("GetIngredient");

        group.MapPost("/", async (
            IngredientRequest request,
            IRepository<Guid, IngredientEntity> store,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Category))
            {
                return ApiResults.Invalid(["An ingredient needs a name and a category."]);
            }

            var ingredient = new Ingredient(Guid.NewGuid(), request.Name.Trim(), request.Category.Trim());
            var result = await Ingredients.add(store, ingredient, ct);

            return ApiResults.FromRepository(result, added =>
                Results.Created($"/api/ingredients/{added.Id}", Wire.Ingredient(added)));
        })
        .WithName("AddIngredient");

        group.MapPut("/{id:guid}", async (
            Guid id,
            IngredientRequest request,
            IRepository<Guid, IngredientEntity> store,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Category))
            {
                return ApiResults.Invalid(["An ingredient needs a name and a category."]);
            }

            var ingredient = new Ingredient(id, request.Name.Trim(), request.Category.Trim());
            var result = await Ingredients.update(store, ingredient, ct);

            return ApiResults.FromRepository(result, updated => Results.Ok(Wire.Ingredient(updated)));
        })
        .WithName("UpdateIngredient");

        group.MapDelete("/{id:guid}", async (
            Guid id,
            IRepository<Guid, IngredientEntity> store,
            CancellationToken ct) =>
        {
            // An ingredient a recipe still uses trips the foreign key, which
            // here can only mean "still in use" — a 409, not a 400.
            var result = await Ingredients.delete(store, id, ct);

            return ApiResults.FromRepository(result, Results.NoContent(), ForeignKey.StillInUse);
        })
        .WithName("DeleteIngredient");

        return api;
    }
}
