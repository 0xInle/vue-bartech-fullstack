export function useNetworkStatus() {
  const isOnline = useState("network-status:online", () => true);

  function updateStatus() {
    isOnline.value = navigator.onLine;
  }

  onMounted(() => {
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
  });

  onUnmounted(() => {
    window.removeEventListener("online", updateStatus);
    window.removeEventListener("offline", updateStatus);
  });

  return { isOnline };
}
