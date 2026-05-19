import { parseUnifiedDiff } from "../utils/diffParser";

interface DiffViewerProps {
  text: string;
  mode: "split" | "inline";
  selectedPath?: string | null;
  emptyText?: string;
}

function extractPatchForFile(text: string, selectedPath?: string | null): string {
  if (!selectedPath) return text;
  const blocks = text.split("diff --git ").filter(Boolean);
  for (const block of blocks) {
    const fullBlock = `diff --git ${block}`;
    const match = /\+\+\+ b\/(.+)/.exec(fullBlock);
    if (match && match[1] === selectedPath) return fullBlock;
  }
  return text;
}

export function DiffViewer({ text, mode, selectedPath, emptyText = "Select a file or commit to view changes" }: DiffViewerProps) {
  if (!text) {
    return <div className="diff-empty">{emptyText}</div>;
  }

  const lines = parseUnifiedDiff(extractPatchForFile(text, selectedPath));
  if (mode === "inline") {
    return (
      <div className="diff-table-wrap">
        <table className="diff-table">
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className={`diff-${line.type}`}>
                <td className="diff-ln">{line.leftNumber}</td>
                <td className="diff-ln">{line.rightNumber}</td>
                <td className="diff-code">{line.text || " "}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const pairedRows: Array<{ left?: typeof lines[number]; right?: typeof lines[number] }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = lines[i + 1];
    if (line.type === "del" && next?.type === "add") {
      pairedRows.push({ left: line, right: next });
      i += 1;
      continue;
    }
    if (line.type === "del") {
      pairedRows.push({ left: line });
      continue;
    }
    if (line.type === "add") {
      pairedRows.push({ right: line });
      continue;
    }
    pairedRows.push({ left: line, right: line });
  }

  return (
    <div className="diff-table-wrap">
      <table className="diff-table diff-split">
        <tbody>
          {pairedRows.map((row, index) => (
            <tr key={index}>
              <td className={`diff-ln ${row.left ? `diff-${row.left.type}` : "diff-empty-cell"}`}>{row.left?.leftNumber ?? ""}</td>
              <td className={`diff-code ${row.left ? `diff-${row.left.type}` : "diff-empty-cell"}`}>{row.left?.text || " "}</td>
              <td className={`diff-ln ${row.right ? `diff-${row.right.type}` : "diff-empty-cell"}`}>{row.right?.rightNumber ?? ""}</td>
              <td className={`diff-code ${row.right ? `diff-${row.right.type}` : "diff-empty-cell"}`}>{row.right?.text || " "}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
