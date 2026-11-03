using MealPlan.Core;
using MealPlan.Core.Data;

namespace MealPlan.Host.Endpoints;

public static class PlanEndpoints
{
    /// Days are stored sparsely and a slot holds only a recipe id, so rendering
    /// the grid needs the recipe names alongside. Reading the recipe *entities*
    /// is enough here — the grid never shows ingredients, so there is no reason
    /// to pay for resolving them.
    private static DayResponse ToResponse(DayEntity day, IReadOnlyDictionary<Guid, RecipeEntity> recipes)
    {
        var meals = new Dictionary<string, RecipeSummaryResponse[]>();

        foreach (var slot in day.Meals)
        {
            var planned = slot.Value
                .Select(id => recipes.TryGetValue(id, out var recipe) ? recipe : null)
                .Where(recipe => recipe is not null)
                .Select(recipe => new RecipeSummaryResponse(recipe!.Id, recipe.Name, recipe.Tags.ToArray()))
                .ToArray();

            if (planned.Length == 0)
            {
                continue;
            }

            var mealTime = MealTimeModule.format(Mapping.Domain.mealTime(slot.Key));

            meals[mealTime] = planned;
        }

        return new DayResponse(day.Date, meals);
    }

    public static RouteGroupBuilder MapPlanEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/plan").WithTags("Plan");

        group.MapGet("/", async (
            DateOnly? from,
            DateOnly? to,
            IRepository<DateOnly, DayEntity> plans,
            IRepository<Guid, RecipeEntity> recipes,
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

            var known = await recipes.All(ct);

            if (!known.IsOk)
            {
                return ApiResults.Classify(known.ErrorValue);
            }

            var byId = known.ResultValue.ToDictionary(r => r.Id);
            var days = await Plans.range(plans, from.Value, to.Value, ct);

            return ApiResults.FromRepository(days, found =>
                Results.Ok(found.Select(day => ToResponse(day, byId)).ToArray()));
        })
        .WithName("GetPlan");

        // Adds to the slot rather than replacing it: a meal can be several
        // recipes. Adding one the slot already holds is a no-op.
        group.MapPost("/{date}/{mealTime}", async (
            DateOnly date,
            string mealTime,
            AddMealRequest request,
            IRepository<DateOnly, DayEntity> plans,
            CancellationToken ct) =>
        {
            var slot = MealTimeModule.parse(mealTime);

            if (slot is null)
            {
                return ApiResults.Invalid([$"'{mealTime}' is not a meal time."]);
            }

            var result = await Plans.addMeal(plans, date, slot.Value, request.RecipeId, ct);

            return ApiResults.FromRepository(result, Results.NoContent());
        })
        .WithName("AddMeal");

        group.MapDelete("/{date}/{mealTime}/{recipeId:guid}", async (
            DateOnly date,
            string mealTime,
            Guid recipeId,
            IRepository<DateOnly, DayEntity> plans,
            CancellationToken ct) =>
        {
            var slot = MealTimeModule.parse(mealTime);

            if (slot is null)
            {
                return ApiResults.Invalid([$"'{mealTime}' is not a meal time."]);
            }

            var result = await Plans.removeMeal(plans, date, slot.Value, recipeId, ct);

            return ApiResults.FromRepository(result, Results.NoContent());
        })
        .WithName("RemoveMeal");

        group.MapDelete("/{date}/{mealTime}", async (
            DateOnly date,
            string mealTime,
            IRepository<DateOnly, DayEntity> plans,
            CancellationToken ct) =>
        {
            var slot = MealTimeModule.parse(mealTime);

            if (slot is null)
            {
                return ApiResults.Invalid([$"'{mealTime}' is not a meal time."]);
            }

            // Clears every recipe in the slot. Clearing an already-empty slot succeeds: the caller asked for an
            // end state, and that is the state.
            var result = await Plans.clearMeal(plans, date, slot.Value, ct);

            return ApiResults.FromRepository(result, Results.NoContent());
        })
        .WithName("ClearMeal");

        return api;
    }
}
