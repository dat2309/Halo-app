import React, { useEffect } from 'react';
import { BlurView } from 'expo-blur';

import { Modal, View, useModal } from '@/components/ui';

type Props = {
  children: React.ReactNode;
  title?: string;
  onDismiss?: () => void;
};

export function GlassModal({ children, title, onDismiss }: Props): JSX.Element {
  const modal = useModal();

  useEffect(() => {
    modal.present();
    return () => modal.dismiss();
  }, [modal]);

  return (
    <Modal
      ref={modal.ref}
      snapPoints={['85%']}
      title={title}
      detached
      backgroundStyle={{ backgroundColor: '#1a1a1a' }}
      onDismiss={onDismiss}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <View className="flex-1 bg-[#1a1a1a] p-4 rounded-t-3xl">
        {children}
      </View>
    </Modal>
  );
}


