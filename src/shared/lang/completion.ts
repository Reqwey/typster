import type {
  CancellationToken,
  editor,
  IRange,
  Position,
} from "monaco-editor";
import { languages } from "monaco-editor";

import { invoke } from "@tauri-apps/api/core";

import CompletionTriggerKind = languages.CompletionTriggerKind;
import { TypstCompleteResponse, TypstCompletionKind } from "../../pages/typst/interface";

export const autocomplete = (
  path: string,
  content: string,
  offset: number,
  explicit: boolean
): Promise<TypstCompleteResponse> =>
  invoke<TypstCompleteResponse>("typst_autocomplete", {
    path,
    content,
    offset,
    explicit,
  });


export class TypstCompletionProvider
  implements languages.CompletionItemProvider {
  triggerCharacters = [" ", "(", "[", "{", "$", "@", "#", "."];

  async provideCompletionItems(
    model: editor.ITextModel,
    position: Position,
    context: languages.CompletionContext,
    token: CancellationToken
  ): Promise<languages.CompletionList> {
    console.warn("completing", position, context);
    const { offset: completionOffset, completions } = await autocomplete(
      model.uri.path,
      model.getValue(),
      model.getOffsetAt(position),
      context.triggerKind === CompletionTriggerKind.Invoke
    );
    console.log("completed", completionOffset, completions);

    const completionPosition = model.getPositionAt(completionOffset);
    const range: IRange = {
      startLineNumber: completionPosition.lineNumber,
      startColumn: completionPosition.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    };

    return {
      suggestions: completions.map((completion: any) => {
        let kind = languages.CompletionItemKind.Snippet;
        switch (completion.kind) {
          case TypstCompletionKind.Syntax:
            kind = languages.CompletionItemKind.Snippet;
            break;
          case TypstCompletionKind.Function:
            kind = languages.CompletionItemKind.Function;
            break;
          case TypstCompletionKind.Parameter:
            kind = languages.CompletionItemKind.Variable;
            break;
          case TypstCompletionKind.Constant:
            kind = languages.CompletionItemKind.Constant;
            break;
          case TypstCompletionKind.Symbol:
            kind = languages.CompletionItemKind.Keyword;
            break;
          case TypstCompletionKind.Type:
            kind = languages.CompletionItemKind.Class;
            break;
        }

        let count = 0;
        const insertText =
          completion.apply?.replace(/\${/g, (r: any) => `${r}${++count}:`) ||
          completion.label;

        return {
          label: completion.label,
          kind,
          insertText: insertText,
          detail: completion.detail ?? undefined,
          insertTextRules:
            languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        };
      }),
    };
  }
}

