using MealPlan.Core;
using Microsoft.FSharp.Core;

namespace MealPlan.Host;

/// Which way a foreign key failure points. The database reports both
/// directions with the same message, but the endpoint always knows which one
/// it could have caused: a write can refer to something missing, a delete can
/// only collide with something that still refers to it.
public enum ForeignKey
{
    MissingReference,
    StillInUse
}

/// Turns the domain's results into HTTP responses.
public static class ApiResults
{
    /// Repositories report failure as a message rather than a typed error, so
    /// the status has to be inferred from the text they write. This is a wart —
    /// the fix is a `RepositoryError` union on `IRepository`, which touches
    /// every repository implementation and is a change for another day.
    public static IResult Classify(string message, ForeignKey foreignKey = ForeignKey.MissingReference)
    {
        if (message.StartsWith("No ", StringComparison.Ordinal))
        {
            return Results.Problem(message, statusCode: StatusCodes.Status404NotFound);
        }

        if (message.Contains("already exists", StringComparison.Ordinal)
            || message.Contains("was changed by someone else", StringComparison.Ordinal))
        {
            return Results.Problem(message, statusCode: StatusCodes.Status409Conflict);
        }

        if (message.Contains("FOREIGN KEY", StringComparison.OrdinalIgnoreCase))
        {
            return foreignKey == ForeignKey.StillInUse
                ? Results.Problem(
                    "Something still uses this, so it cannot be deleted. Remove it from any recipe or meal plan first.",
                    statusCode: StatusCodes.Status409Conflict)
                : Results.Problem(
                    "The request refers to a recipe or ingredient that does not exist.",
                    statusCode: StatusCodes.Status400BadRequest);
        }

        return Results.Problem(message, statusCode: StatusCodes.Status500InternalServerError);
    }

    public static IResult FromRepository<T>(
        FSharpResult<T, string> result,
        Func<T, IResult> onOk,
        ForeignKey foreignKey = ForeignKey.MissingReference) =>
        result.IsOk ? onOk(result.ResultValue) : Classify(result.ErrorValue, foreignKey);

    public static IResult FromRepository(
        FSharpResult<Unit, string> result,
        IResult onOk,
        ForeignKey foreignKey = ForeignKey.MissingReference) =>
        result.IsOk ? onOk : Classify(result.ErrorValue, foreignKey);

    /// A 400 carrying the caller-facing wording, so the UI never has to invent
    /// a message for a rule it does not own.
    public static IResult Invalid(IEnumerable<string> errors, string title = "The request is not valid.") =>
        Results.Problem(
            title: title,
            statusCode: StatusCodes.Status400BadRequest,
            extensions: new Dictionary<string, object?> { ["errors"] = errors.ToArray() });

    public static IResult FromRecipe<T>(
        FSharpResult<T, Recipes.RecipeError> result,
        Func<T, IResult> onOk,
        ForeignKey foreignKey = ForeignKey.MissingReference)
    {
        if (result.IsOk)
        {
            return onOk(result.ResultValue);
        }

        return result.ErrorValue switch
        {
            Recipes.RecipeError.Invalid invalid =>
                Invalid(invalid.Item.Select(AddRecipeErrorModule.describe), "The recipe is not valid."),
            Recipes.RecipeError.Failed failed => Classify(failed.Item, foreignKey),
            _ => Results.Problem("The recipe could not be saved.")
        };
    }
}
