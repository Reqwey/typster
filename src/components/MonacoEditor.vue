<template>
  <div class="editor" ref="boxRef"></div>
</template>

<script setup lang="ts">
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { PropType, onMounted, ref, warn, watch } from "vue";
import { TypstCompileResult } from "../pages/typst/interface";
import type { editor as editorType } from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import { relativePath } from './../shared/util'

import { throttle, debounce } from 'radash'

type IModelChangedEvent = editorType.IModelChangedEvent;
type IModelContentChangedEvent = editorType.IModelContentChangedEvent;
type ICodeEditor = editorType.ICodeEditor;


const props = defineProps({
  path: String as PropType<string>,
  root: String as PropType<string>,
})

const emit = defineEmits<{
  (e: 'change', text: string): void
  (e: 'compiled', data: TypstCompileResult): void
}>()

const boxRef = ref<HTMLElement>();
let monacoEditor: monaco.editor.IStandaloneCodeEditor | null = null;


const updateContent = async (editor: ICodeEditor, path: string) => {
   console.warn('updateContent -------')
  if (!editor) return;

  // Prevent further updates and immediately flush pending updates
  editor.updateOptions({ readOnly: true });

  editor.getModel()?.dispose();

  try {
    console.log('read file path:', path);
    const content = await invoke<string>('fs_read_file_text', { path });
    const uri = monaco.Uri.file(path);
    console.log('uri:', uri)
    let editorModel = monaco.editor.getModel(uri);
    if (editorModel) {
      // Update existing model. This should only be possible in development mode
      // after hot reload.
      editorModel.setValue(content);
    } else {
      editorModel = monaco.editor.createModel(content, undefined, uri);
    }
    editor.setModel(editorModel);
  } catch (err) {
    console.warn(err)
  } finally {
    editor.updateOptions({ readOnly: false });
  }
};

const handleCompile = async () => {

  const editorModel = monacoEditor?.getModel();
  if (editorModel) {

    const content = editorModel.getValue()
    const path = relativePath(props.root!, props.path!)

    const pages = await invoke<TypstCompileResult>('typst_compile_doc', { path, content })

    emit('compiled', pages)
  }
};
const handleSave = async () => {
  const model = monacoEditor?.getModel();
  if (model) {
    // Removing the preceding slash
    const path = relativePath(props.root!, props.path!);
    await invoke("fs_write_file_text", { path, content: model.getValue() });
    await handleCompile();
  }
};


//@ts-ignore
const handleCompileThrottle = throttle({ interval: 1000 }, handleCompile);
const handleSaveDebounce = debounce({ delay: 500 }, handleSave);


onMounted(() => {
  if (!boxRef.value) {
    return;
  }

  monacoEditor = monaco.editor.create(boxRef.value!, {
    language: "typst",
    fontSize: 16,
    lineHeight: 28,
    scrollBeyondLastColumn: 2,
    automaticLayout: true,
    minimap: { enabled: false },
  });

  monacoEditor.onDidChangeModel((evt: IModelChangedEvent) => {
    handleCompileThrottle();
  });
  monacoEditor.onDidChangeModelContent((evt: IModelContentChangedEvent) => {
    // 输入的时候 每隔1秒执行一次编译
    handleCompileThrottle();
    // 输入完毕后 500ms 后执行一次保存
    handleSaveDebounce();
  });

  updateContent(monacoEditor, props.path!)

  return () => {
    if (monacoEditor) {
      monacoEditor.dispose();
    }
  }
});


watch(() => props.path, () => {
  if (monacoEditor && props.path) {
    updateContent(monacoEditor, props.path)
  }
})


</script>

<style scoped>
.editor {
  box-sizing: border-box;
  padding: 16px 0px;
  height: 100%;
  overflow: hidden;
}
</style>
