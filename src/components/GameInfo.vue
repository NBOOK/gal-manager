<script setup lang="ts">
  import { reactive } from "vue";
  import GameEntry from "@/modules/GameEntry";

  defineProps<{ game: GameEntry }>(); // use props.game to access the game object

  const overflowStates = reactive<Record<string, boolean>>({});

  function formatTime(unixTime: number): string {
    const date = new Date(unixTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} Bytes`;
    const units = ["KB", "MB", "GB", "TB"];
    let size = bytes / 1024; // 转换为 KB
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
  function isOverflow(element: HTMLElement | null): boolean {
    if (!element) return false;
    return element.scrollWidth > element.clientWidth;
  }

  const vOverflowDetector = {
    mounted(el: HTMLElement, binding: { value: string }) {
      const key = binding.value;
      if (!key) return;

      const updateState = () => {
        overflowStates[key] = isOverflow(el as HTMLElement);
      };

      // 动态注册 ResizeObserver
      const resizeObserver = new ResizeObserver(updateState);

      // 使用 IntersectionObserver 监测元素是否进入视窗
      const intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            // 元素进入视窗，开始观察
            resizeObserver.observe(el as HTMLElement);
            updateState(); // 初始化状态
          } else {
            // 元素离开视窗，停止观察
            resizeObserver.disconnect();
          }
        },
        { threshold: 0.1 } // 可以根据需要调整阈值
      );

      // 观察当前元素的可见性
      intersectionObserver.observe(el as HTMLElement);

      // 在元素上存储观察器以便清理
      el.__resizeObserver__ = resizeObserver;
      el.__intersectionObserver__ = intersectionObserver;
    },
    unmounted(el: HTMLElement) {
      // 清理 ResizeObserver
      el.__resizeObserver__?.disconnect();
      delete el.__resizeObserver__;

      // 清理 IntersectionObserver
      el.__intersectionObserver__?.disconnect();
      delete el.__intersectionObserver__;
    },
  };
</script>

<template>
  <!-- 中间内容 -->
  <div class="game-details mt-1">
    <div v-overflow-detector="'game-name'" class="scroll-container">
      <div class="game-name" :class="{ scrolled: overflowStates['game-name'] }">
        {{ game.gameName }}
      </div>
    </div>

    <div v-overflow-detector="'game-name-en'" class="scroll-container">
      <div
        class="game-name-en"
        :class="{ scrolled: overflowStates['game-name-en'] }"
      >
        {{ game.gameNameEN }}
      </div>
    </div>

    <div v-overflow-detector="'game-brand'" class="scroll-container">
      <div
        class="game-brand"
        :class="{ scrolled: overflowStates['game-brand'] }"
      >
        {{ game.gameBrand }}
        {{
          game.gameBrandEN.toLowerCase() === game.gameBrand.toLowerCase()
            ? ""
            : ` | ${game.gameBrandEN}`
        }}
      </div>
    </div>

    <div class="game-meta mt-1">
      {{ formatTime(game.modifiedTime) }}&nbsp&nbsp&nbsp&nbsp{{
        formatSize(game.diskUsage)
      }}
    </div>
  </div>
</template>

<style scoped>
  .game-details {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: calc(100% - 335px);
    min-width: 180px;
    /* max-width: 100%; */
  }

  .game-name {
    /* display: inline-block; */
    /* position: relative;
  text-overflow: clip;
  margin-right: 5px;
  margin-left: 5px; */
    /* height: 32px; */
    font-size: 16px;
  }

  .game-brand,
  .game-name-en,
  .game-meta {
    font-size: 14px;
    color: #8a8a8a;
    max-width: 100%;
  }

  .scroll-container {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    overflow: hidden;
    max-width: 100%;
  }

  .scrolled:hover {
    animation: scroll-rtl 10s linear infinite;
  }

  @keyframes scroll-rtl {
    from {
      transform: translate(0%);
    }

    to {
      transform: translate(-100%);
    }
  }
</style>
