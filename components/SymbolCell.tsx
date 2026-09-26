/** Symbol with a round monogram, in the spirit of an avatar, and the company name beneath. */
export function SymbolCell({ symbol, name, tone }: { symbol: string; name: string; tone: string }) {
  return (
    <div className="symbol">
      <span className={`mono tone-${tone}`} aria-hidden>
        {symbol.slice(0, 1)}
      </span>
      <div>
        <strong>{symbol}</strong>
        <div className="sub">{name}</div>
      </div>
    </div>
  );
}
