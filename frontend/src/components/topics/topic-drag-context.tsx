"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { TopicResponse } from "@/lib/topics";

interface TopicDragContextValue {
  draggedTopic: TopicResponse | null;
  startDrag: (topic: TopicResponse) => void;
  endDrag: () => void;
  removedChildId: string | null;
  notifyMoved: (topicId: string) => void;
  clearMoved: () => void;
}

const TopicDragContext = createContext<TopicDragContextValue>({
  draggedTopic: null,
  startDrag: () => {},
  endDrag: () => {},
  removedChildId: null,
  notifyMoved: () => {},
  clearMoved: () => {},
});

export function useTopicDrag() {
  return useContext(TopicDragContext);
}

export function TopicDragProvider({ children }: { children: ReactNode }) {
  const [draggedTopic, setDraggedTopic] = useState<TopicResponse | null>(null);
  const [removedChildId, setRemovedChildId] = useState<string | null>(null);

  const startDrag = useCallback(
    (topic: TopicResponse) => setDraggedTopic(topic),
    [],
  );
  const endDrag = useCallback(() => setDraggedTopic(null), []);
  const notifyMoved = useCallback((id: string) => setRemovedChildId(id), []);
  const clearMoved = useCallback(() => setRemovedChildId(null), []);

  return (
    <TopicDragContext.Provider
      value={{
        draggedTopic,
        startDrag,
        endDrag,
        removedChildId,
        notifyMoved,
        clearMoved,
      }}
    >
      {children}
    </TopicDragContext.Provider>
  );
}
