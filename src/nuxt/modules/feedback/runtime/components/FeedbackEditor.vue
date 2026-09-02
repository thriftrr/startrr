<script setup lang="ts">
// TipTap editor that speaks Markdown: what leaves this component is a
// Markdown string (tiptap-markdown serializes the document), which is what
// the server stores. Client-only — ProseMirror needs a DOM; the parent wraps
// it in <ClientOnly>.
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const editor = useEditor({
  content: props.modelValue,
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      // Keep the toolbar honest: no images/links/tables to sanitize later.
      link: false,
      horizontalRule: false
    }),
    Markdown.configure({
      html: false,
      transformPastedText: true,
      transformCopiedText: true
    })
  ],
  editorProps: {
    attributes: { 'class': 'fb-editor-body', 'role': 'textbox', 'aria-multiline': 'true', 'aria-label': 'Feedback' }
  },
  onUpdate: ({ editor: e }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tiptap-markdown registers its storage at runtime
    const markdown: string = (e.storage as any).markdown.getMarkdown()
    emit('update:modelValue', markdown)
  }
})

watch(() => props.disabled, off => editor.value?.setEditable(!off))

// Clearing from the outside (after a successful send) resets the doc.
watch(() => props.modelValue, (value) => {
  if (value === '' && editor.value && !editor.value.isEmpty) editor.value.commands.clearContent(true)
})

const isEmpty = computed(() => editor.value?.isEmpty ?? true)

onBeforeUnmount(() => editor.value?.destroy())

defineExpose({ focus: () => editor.value?.commands.focus() })

type Tool = { key: string, label: string, title: string, run: () => void, active: () => boolean }
const tools: Tool[] = [
  { key: 'bold', label: 'B', title: 'Bold (⌘B)', run: () => editor.value?.chain().focus().toggleBold().run(), active: () => Boolean(editor.value?.isActive('bold')) },
  { key: 'italic', label: 'I', title: 'Italic (⌘I)', run: () => editor.value?.chain().focus().toggleItalic().run(), active: () => Boolean(editor.value?.isActive('italic')) },
  { key: 'heading', label: 'H', title: 'Heading', run: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(), active: () => Boolean(editor.value?.isActive('heading', { level: 2 })) },
  { key: 'bullet', label: '•', title: 'Bullet list', run: () => editor.value?.chain().focus().toggleBulletList().run(), active: () => Boolean(editor.value?.isActive('bulletList')) },
  { key: 'ordered', label: '1.', title: 'Numbered list', run: () => editor.value?.chain().focus().toggleOrderedList().run(), active: () => Boolean(editor.value?.isActive('orderedList')) },
  { key: 'code', label: '</>', title: 'Code', run: () => editor.value?.chain().focus().toggleCode().run(), active: () => Boolean(editor.value?.isActive('code')) },
  { key: 'codeblock', label: '{ }', title: 'Code block', run: () => editor.value?.chain().focus().toggleCodeBlock().run(), active: () => Boolean(editor.value?.isActive('codeBlock')) }
]
</script>

<template>
  <div
    class="fb-editor"
    :class="{ disabled }"
  >
    <div
      class="fb-toolbar"
      role="toolbar"
      aria-label="Formatting"
    >
      <button
        v-for="tool in tools"
        :key="tool.key"
        type="button"
        class="fb-tool"
        :class="{ on: tool.active(), [tool.key]: true }"
        :title="tool.title"
        :aria-label="tool.title"
        :aria-pressed="tool.active()"
        :disabled="disabled"
        @mousedown.prevent
        @click="tool.run()"
      >
        {{ tool.label }}
      </button>
      <span class="fb-hint">Markdown shortcuts work too: <code>**bold**</code>, <code>- list</code></span>
    </div>
    <div
      class="fb-surface"
      @click="editor?.commands.focus()"
    >
      <div
        v-if="isEmpty"
        class="fb-placeholder"
        aria-hidden="true"
      >
        {{ placeholder ?? 'What happened? What did you expect?' }}
      </div>
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>

<style scoped>
.fb-editor {
  border: 1.5px solid var(--border-input);
  border-radius: var(--r-field);
  background: var(--bg-input);
  overflow: hidden;
}
.fb-editor:focus-within { border-color: var(--teal); }
.fb-editor.disabled { opacity: 0.6; }

.fb-toolbar {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg-sunk);
  flex-wrap: wrap;
}
.fb-tool {
  min-width: 28px;
  height: 26px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--fg-muted);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
  line-height: 1;
}
.fb-tool.italic { font-style: italic; }
.fb-tool.code, .fb-tool.codeblock { font-family: ui-monospace, Menlo, monospace; font-size: 11px; }
.fb-tool:hover:not(:disabled) { background: var(--bg-card); color: var(--fg); border-color: var(--border); }
.fb-tool.on { background: var(--teal-badge); color: var(--teal-dark); border-color: var(--teal-border); }
.fb-hint { margin-left: auto; font-size: 11px; color: var(--fg-muted); }
.fb-hint code { background: var(--bg-card); padding: 0 4px; border-radius: 4px; }

.fb-surface { position: relative; min-height: 160px; cursor: text; }
.fb-placeholder {
  position: absolute;
  top: 12px;
  left: 14px;
  color: var(--fg-faint);
  font-size: 14px;
  pointer-events: none;
}
</style>

<style>
/* ProseMirror renders its own root, so its styles can't be scoped. */
.fb-editor-body {
  min-height: 160px;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--fg);
  outline: none;
}
.fb-editor-body > * + * { margin-top: 0.6em; }
.fb-editor-body p { margin: 0; }
.fb-editor-body h2 { font-size: 17px; font-weight: 800; margin: 0; }
.fb-editor-body h3 { font-size: 15px; font-weight: 800; margin: 0; }
.fb-editor-body ul, .fb-editor-body ol { margin: 0; padding-left: 22px; }
.fb-editor-body li + li { margin-top: 0.2em; }
.fb-editor-body code {
  background: var(--bg-sunk);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12.5px;
}
.fb-editor-body pre {
  background: var(--fg);
  color: var(--nav-fg);
  border-radius: 10px;
  padding: 12px 14px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12.5px;
  overflow: auto;
}
.fb-editor-body pre code { background: none; border: none; padding: 0; color: inherit; font-size: inherit; }
.fb-editor-body blockquote {
  margin: 0;
  padding-left: 12px;
  border-left: 3px solid var(--teal-border);
  color: var(--fg-muted);
}
</style>
