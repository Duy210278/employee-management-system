import { ref } from 'vue';

const message = ref<string | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

/** Toast ở đáy giữa màn hình, tự ẩn sau 2,6 giây (mục 15.3) */
export function useToast() {
  return {
    message,
    show(text: string) {
      message.value = text;
      clearTimeout(timer);
      timer = setTimeout(() => (message.value = null), 2600);
    },
  };
}
