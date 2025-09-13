import { SerializedEditorState } from 'lexical'

import { ChatUserMessage } from '../../types/chat'
import { Mentionable } from '../../types/mentionable'

import ChatUserInput, { ChatUserInputRef } from './chat-input/ChatUserInput'
import SimilaritySearchResults from './SimilaritySearchResults'

export type UserMessageItemProps = {
  message: ChatUserMessage
  chatUserInputRef: (ref: ChatUserInputRef | null) => void
  onInputChange: (content: SerializedEditorState) => void
  onSubmit: (content: SerializedEditorState, useVaultSearch: boolean) => void
  onFocus: () => void
  onMentionablesChange: (mentionables: Mentionable[]) => void
  modelId?: string
  onModelChange?: (modelId: string) => void
}

export default function UserMessageItem({
  message,
  chatUserInputRef,
  onInputChange,
  onSubmit,
  onFocus,
  onMentionablesChange,
  modelId,
  onModelChange,
}: UserMessageItemProps) {
  return (
    <div className="smtcmp-chat-messages-user">
      <ChatUserInput
        ref={chatUserInputRef}
        initialSerializedEditorState={message.content}
        onChange={onInputChange}
        onSubmit={onSubmit}
        onFocus={onFocus}
        mentionables={message.mentionables}
        setMentionables={onMentionablesChange}
        modelId={modelId}
        onModelChange={onModelChange}
      />
      {message.similaritySearchResults && (
        <SimilaritySearchResults
          similaritySearchResults={message.similaritySearchResults}
        />
      )}
    </div>
  )
}
