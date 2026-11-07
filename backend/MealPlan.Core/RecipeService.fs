namespace MealPlan.Core

open System

type AddRecipeError =
    | BlankName
    | BlankStep of index: int
    | NoIngredients
    | BlankIngredientName
    | BlankIngredientCategory of ingredient: string
    | ZeroQuantity of ingredient: string
    | DuplicateIngredient of ingredient: string
    | BlankTag
    | BlankReference

module AddRecipeError =

    let describe error =
        match error with
        | BlankName -> "A recipe needs a name."
        | BlankStep i -> $"Step %d{i + 1} is empty."
        | NoIngredients -> "A recipe needs at least one ingredient."
        | BlankIngredientName -> "An ingredient has no name."
        | BlankIngredientCategory name -> $"Ingredient '%s{name}' has no category."
        | ZeroQuantity name -> $"Ingredient '%s{name}' has a quantity of zero."
        | DuplicateIngredient name -> $"Ingredient '%s{name}' is listed more than once."
        | BlankTag -> "A tag is empty."
        | BlankReference -> "The reference is present but empty."

module RecipeService =

    let private trim (s: string) = if isNull s then "" else s.Trim()

    let private isBlank (s: string) = String.IsNullOrWhiteSpace s

    let private display name =
        if isBlank name then "<unnamed>" else trim name

    let private validateSteps steps =
        let errors =
            steps
            |> List.indexed
            |> List.choose (fun (i, Step text) -> if isBlank text then Some(BlankStep i) else None)

        errors, steps |> List.map (fun (Step text) -> Step(trim text))

    let private validateIngredient (recipeIngredient: RecipeIngredient) =
        let ingredient = recipeIngredient.Ingredient
        let name = display ingredient.Name

        let errors =
            [ if isBlank ingredient.Name then BlankIngredientName
              if isBlank ingredient.Category then BlankIngredientCategory name
              if recipeIngredient.Quantity.Amount = 0u then ZeroQuantity name ]

        let normalised =
            { recipeIngredient with
                Ingredient =
                    { ingredient with
                        Name = trim ingredient.Name
                        Category = trim ingredient.Category } }

        errors, normalised

    let private duplicateErrors ingredients =
        ingredients
        |> List.countBy (fun i -> (trim i.Ingredient.Name).ToLowerInvariant())
        |> List.filter (fun (name, count) -> count > 1 && name <> "")
        |> List.map (fst >> DuplicateIngredient)

    let private validateIngredients ingredients =
        match ingredients with
        | [] -> [ NoIngredients ], []
        | _ ->
            let errors, normalised = ingredients |> List.map validateIngredient |> List.unzip
            List.concat errors @ duplicateErrors ingredients, normalised

    let private validateTags tags =
        let errors = if tags |> List.exists isBlank then [ BlankTag ] else []
        let normalised = tags |> List.map trim |> List.distinctBy _.ToLowerInvariant()
        errors, normalised

    let private validateReference reference =
        match reference with
        | Some r when isBlank r -> [ BlankReference ], None
        | Some r -> [], Some(trim r)
        | None -> [], None

    /// Checks a recipe and returns a trimmed, de-duplicated copy of it.
    /// An empty Id is filled in with a fresh one; a supplied Id is kept.
    let validate (newId: unit -> Guid) (recipe: Recipe) : Result<Recipe, AddRecipeError list> =
        let nameErrors = if isBlank recipe.Name then [ BlankName ] else []
        let stepErrors, steps = validateSteps recipe.Steps
        let ingredientErrors, ingredients = validateIngredients recipe.Ingredients
        let tagErrors, tags = validateTags recipe.Tags
        let referenceErrors, reference = validateReference recipe.Reference

        match nameErrors @ stepErrors @ ingredientErrors @ tagErrors @ referenceErrors with
        | [] ->
            Ok
                { Id = (if recipe.Id = Guid.Empty then newId () else recipe.Id)
                  Name = trim recipe.Name
                  Steps = steps
                  Ingredients = ingredients
                  Tags = tags
                  Reference = reference }
        | errors -> Error errors
