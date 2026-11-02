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
    // Off in development: the Vite dev server proxies plain HTTP to this port,
    // and a redirect to the HTTPS port breaks every call it forwards.
    app.UseHttpsRedirection();

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
