/**
 * Executa funções assíncronas com limite de concorrência.
 * @param {number} concurrency - Número máximo de operações simultâneas
 * @param {Array} items - Itens a processar
 * @param {Function} fn - Função assíncrona a aplicar em cada item
 * @returns {Promise<Array>} - Array com os resultados na mesma ordem
 */
export async function asyncPool(concurrency, items, fn) {
    const results = [];
    const executing = new Set();

    for (const [index, item] of items.entries()) {
        const p = fn(item, index).then((result) => {
            executing.delete(p);
            return result;
        });

        results.push(p);
        executing.add(p);

        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }

    return Promise.all(results);
}
