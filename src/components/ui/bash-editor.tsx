import React, { type ChangeEventHandler } from "react";
import CodeEditor from "@uiw/react-textarea-code-editor";
import { Textarea } from "./textarea";

export default function BashEditor({
  onChange,
  editorRef,
}: {
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  editorRef?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <CodeEditor
      language="shell"
      data-color-mode="light"
      onChange={onChange}
      className="h-64 resize-y rounded-lg font-mono text-lg font-semibold"
      ref={editorRef}
    />
  );
}
