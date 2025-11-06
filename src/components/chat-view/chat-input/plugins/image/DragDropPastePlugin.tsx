import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { DRAG_DROP_PASTE } from '@lexical/rich-text'
import { COMMAND_PRIORITY_LOW } from 'lexical'
import { useEffect } from 'react'

import { MentionableImage } from '../../../../../types/mentionable'
import { fileToMentionableImage } from '../../../../../utils/llm/image'

export default function DragDropPaste({
  onCreateImageMentionables,
}: {
  onCreateImageMentionables?: (mentionables: MentionableImage[]) => void
}): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      DRAG_DROP_PASTE, // dispatched in RichTextPlugin
      (files) => {
        const images = files.filter((file) => file.type.startsWith('image/'))
        void Promise.all(images.map((image) => fileToMentionableImage(image)))
          .then((mentionableImages) => {
            onCreateImageMentionables?.(mentionableImages)
          })
          .catch((error) => {
            console.error('Failed to process dropped/pasted images', error)
          })
        return true
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, onCreateImageMentionables])

  return null
}
