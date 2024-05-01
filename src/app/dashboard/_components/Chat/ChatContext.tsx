import { trpc } from '@/app/_trpc/client';
import { useToast } from '@/components/ui/use-toast';
import { useMutation } from '@tanstack/react-query';
import React, { createContext, ReactNode, useState } from 'react';

type Props = {
  addMessage: () => void;
  message: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
};

export const ChatContext = createContext<Props>({
  addMessage: () => {},
  message: '',
  handleInputChange: () => {},
  isLoading: false,
});

interface ProviderProps {
  fileId: string;
  children: ReactNode;
}

export const ChatContextProvider = ({ fileId, children }: ProviderProps) => {
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { toast } = useToast();

  const utils = trpc.useContext();

  const { mutate: sendMessage } = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      const response = await fetch('/api/message', {
        method: 'POST',
        body: JSON.stringify({
          fileId,
          message,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.body;
    },
  });

  const addMessage = () => sendMessage({ message });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  return (
    <ChatContext.Provider
      value={{
        addMessage,
        handleInputChange,
        isLoading,
        message,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
