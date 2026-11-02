namespace MealPlan.Core.Data

open System.Threading
open System.Threading.Tasks

type IRepository<'TK, 'T> =
    abstract member Get: 'TK * CancellationToken -> Task<Result<'T, string>>
    abstract member Add: 'T * CancellationToken -> Task<Result<'T, string>>
    abstract member Update: 'T * CancellationToken -> Task<Result<'T, string>>
    abstract member Delete: 'TK * CancellationToken -> Task<Result<unit, string>>
    abstract member All: CancellationToken -> Task<Result<'T list, string>>
    /// The predicate runs over the loaded records, not in the store, so this
    /// reads everything `All` would.
    abstract member Query: ('T -> bool) * CancellationToken -> Task<Result<'T list, string>>
