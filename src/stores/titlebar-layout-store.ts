import { create } from 'zustand'

type TitlebarLayout = {
  position: 'left' | 'right'
}

export const useTitlebarLayout = create<TitlebarLayout>()(() => ({
  position: 'right',
}))
