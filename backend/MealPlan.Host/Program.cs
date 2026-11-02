using MealPlan.Core.Data;
using MealPlan.Host.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var connectionString = builder.Configuration.GetConnectionString("MealPlan")
                       ?? "Data Source=mealplan.db";

builder.Services.AddSingleton<IRepository<Guid, IngredientEntity>>(
    _ => new SqliteIngredientRepository(connectionString));

builder.Services.AddSingleton<IRepository<Guid, RecipeEntity>>(
    _ => new SqliteRecipeRepository(connectionString));

builder.Services.AddSingleton<IRepository<DateOnly, DayEntity>>(
    _ => new SqlitePlanRepository(connectionString));

var app = builder.Build();

// Creates any missing tables; safe to run on every start-up.
await Sqlite.migrate(connectionString, CancellationToken.None);

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    // No HTTPS redirect: the container serves plain HTTP, and TLS is left to
    // whatever sits in front of it.

    // The built SPA, which `npm run build` writes into wwwroot.
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.MapGroup("/api")
    .MapIngredientEndpoints()
    .MapRecipeEndpoints()
    .MapPlanEndpoints()
    .MapShoppingListEndpoints();

if (!app.Environment.IsDevelopment())
{
    // Client-side routes are not files, so a refresh on /recipes has to come
    // back as the shell rather than a 404.
    app.MapFallbackToFile("index.html");
}

app.Run();
