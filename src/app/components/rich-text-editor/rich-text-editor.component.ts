import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.scss',
})
export class RichTextEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) content: Record<string, unknown> | null = null;
  @Input() disabled = false;
  @Output() readonly contentChange = new EventEmitter<Record<string, unknown>>();

  @ViewChild('editorHost', { static: true }) editorHost?: ElementRef<HTMLElement>;

  protected editor: Editor | null = null;
  protected readonly palette = ['#1a1614', '#2b241e', '#574636', '#8f6d4a', '#b66a3f', '#7b3023'];
  protected selectedColor = '#1a1614';

  private isApplyingExternalContent = false;

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.editorHost?.nativeElement,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Underline,
        TextStyle,
        Color,
      ],
      editable: !this.disabled,
      content: this.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      onUpdate: ({ editor }) => {
        if (this.isApplyingExternalContent) {
          return;
        }

        this.contentChange.emit(editor.getJSON());
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.editor) {
      return;
    }

    if (changes['disabled']) {
      this.editor.setEditable(!this.disabled);
    }

    if (!changes['content']) {
      return;
    }

    const nextContent = this.content ?? { type: 'doc', content: [{ type: 'paragraph' }] };
    const currentContent = this.editor.getJSON();

    if (JSON.stringify(nextContent) === JSON.stringify(currentContent)) {
      return;
    }

    this.isApplyingExternalContent = true;
    this.editor.commands.setContent(nextContent, { emitUpdate: false });
    this.isApplyingExternalContent = false;
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  protected run(command: () => boolean): void {
    if (this.disabled || !this.editor) {
      return;
    }

    command();
  }

  protected toggleBold(): void {
    this.run(() => this.editor!.chain().focus().toggleBold().run());
  }

  protected toggleItalic(): void {
    this.run(() => this.editor!.chain().focus().toggleItalic().run());
  }

  protected toggleUnderline(): void {
    this.run(() => this.editor!.chain().focus().toggleUnderline().run());
  }

  protected toggleBulletList(): void {
    this.run(() => this.editor!.chain().focus().toggleBulletList().run());
  }

  protected toggleOrderedList(): void {
    this.run(() => this.editor!.chain().focus().toggleOrderedList().run());
  }

  protected toggleBlockquote(): void {
    this.run(() => this.editor!.chain().focus().toggleBlockquote().run());
  }

  protected toggleCodeBlock(): void {
    this.run(() => this.editor!.chain().focus().toggleCodeBlock().run());
  }

  protected clearFormatting(): void {
    this.run(() => this.editor!.chain().focus().unsetAllMarks().clearNodes().run());
  }

  protected setHeading(level: 1 | 2 | 3): void {
    this.run(() => this.editor!.chain().focus().toggleHeading({ level }).run());
  }

  protected setParagraph(): void {
    this.run(() => this.editor!.chain().focus().setParagraph().run());
  }

  protected applyColor(color: string): void {
    this.selectedColor = color;
    this.run(() => this.editor!.chain().focus().setColor(color).run());
  }

  protected isActive(name: string, attrs?: Record<string, unknown>): boolean {
    return this.editor?.isActive(name, attrs) ?? false;
  }
}
