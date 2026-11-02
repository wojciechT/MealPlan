using MealPlan.Core;
using MealPlan.Core.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var connectionString = builder.Configuration.GetConnectionString("MealPlan")
                       ?? "Data Source=mealplan.db";

builder.Services.AddSingleton<IRepository<Guid, IngredientEntity>>(
    _ => new SqliteIngredientRepository(connectionString));

var app = builder.Build();

// Creates any missing tables; safe to run on every start-up.
await Sqlite.migrate(connectionString, CancellationToken.None);

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapGet("/ingredients", async (
    IRepository<Guid, IngredientEntity> store,
    CancellationToken cancellationToken) =>
{
    var result = await Ingredients.all(store, cancellationToken);

    return result.IsOk
        ? Results.Ok(result.ResultValue.Select(i => new IngredientResponse(i.Id, i.Name, i.Category)))
        : Results.Problem(result.ErrorValue);
})
.WithName("GetIngredients");

app.Run();

record IngredientResponse(Guid Id, string Name, string Category);
