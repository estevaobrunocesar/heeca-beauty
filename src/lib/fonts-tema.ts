import { Cormorant_Garamond } from "next/font/google";

// Serifa de títulos do tema escuro (a mesma do site do Studio 21). `preload: false`: só baixa o arquivo quando um
// estabelecimento com tema usa a fonte; as demais páginas não pagam por ela.
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], display: "swap", preload: false, variable: "--font-cormorant",
});
