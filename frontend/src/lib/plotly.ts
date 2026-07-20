import PlotImport from "react-plotly.js"

/**
 * Ponto único de import do componente Plotly.
 *
 * Motivo: sob Vite + React 19, o `react-plotly.js` (v2.6, CommonJS) é
 * pré-empacotado com um interop que exporta o *namespace* do módulo
 * (`{ __esModule: true, default: Componente }`) como default — em vez de
 * desembrulhar o `.default`. Assim `import Plot from "react-plotly.js"` vira um
 * OBJETO, não um componente, e o React lança
 *   "Element type is invalid: ... but got: object"
 * derrubando toda a árvore (tela preta) ao renderizar qualquer gráfico.
 *
 * Desembrulhamos o `.default` defensivamente: funciona quer o bundler
 * desembrulhe ou não (dev/esbuild e build/rollup), sem depender do factory
 * nem trocar a dependência do plotly.
 */
const Plot = (
  (PlotImport as unknown as { default?: typeof PlotImport })?.default ?? PlotImport
) as typeof PlotImport

export default Plot
