<script setup lang="ts">
import { reactive, computed } from "vue";
// import { useGameStore } from '@store/global-store'
import GameEntry from "@modules/GameEntry";
// import { link } from "original-fs";

const props = defineProps<{ game: GameEntry }>(); // use props.game to access the game object

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

const linkBtn = computed(() => {
  if (props.game.linked) {
    return {
      icon: "mdi-link",
      color: "green",
      readonly: props.game.inLutrisDB || props.game.inSteamDB,
      action: () => props.game.unlink(),
    };
  } else {
    return {
      icon: "mdi-link-off",
      color: "red",
      readonly: false,
      action: () => props.game.link(),
    };
  }
});

const databaseBtn = computed(() => {
  if (props.game.linked) {
    if (props.game.inLutrisDB && props.game.inSteamDB) {
      return {
        icon: "mdi-database-check",
        color: "green",
        readonly: false,
        action: () => props.game.removeDB(),
      };
    } else if (props.game.inLutrisDB !== props.game.inSteamDB) {
      return {
        icon: "mdi-database-minus",
        color: "orange",
        readonly: false,
        action: () => props.game.addDB(),
      };
    } else {
      return {
        icon: "mdi-database-remove",
        color: "red",
        readonly: false,
        action: () => props.game.addDB(),
      };
    }
  } else {
    return {
      icon: "mdi-database-off",
      color: "blue-grey",
      readonly: true,
      action: () => {},
    };
  }
});

const imageBtn = computed(() => {
  if (props.game.imageAssets.assetsCount == 5) {
    return {
      icon: "mdi-image-check",
      color: "green",
      action: () => {},
    };
  } else if (props.game.imageAssets.assetsCount > 0) {
    return {
      icon: "mdi-image-minus",
      color: "orange",
      action: () => props.game.imageAssets.openImageOrGameFolder(),
    };
  } else {
    return {
      icon: "mdi-image-remove",
      color: "red",
      action: () => props.game.imageAssets.openImageOrGameFolder(),
    };
  }
});

const cloudBtn = computed(() => {
  if (props.game.inNetDisk) {
    if (props.game.inDeck || props.game.inSDCard) {
      return {
        icon: "mdi-cloud",
        color: "green",
        readonly: true,
        action: () => {},
      };
    } else {
      return {
        icon: "mdi-cloud-download",
        color: "green",
        readonly: false,
        action: () => (props.game.inDeck = true), //@TODO: 下载到本地
      };
    }
  } else {
    if (props.game.inDeck || props.game.inSDCard) {
      return {
        icon: "mdi-cloud-upload",
        color: "orange",
        readonly: false,
        action: () => (props.game.inNetDisk = true), // @TODO: 上传到云端
      };
    } else {
      // not in cloud or local storage, means the link is broken or name is changed
      return {
        icon: "mdi-cloud",
        color: "blue-grey",
        readonly: true,
        action: () => {},
      };
    }
  }
});

const storageBtn = computed(() => {
  if (props.game.inSDCard) {
    return {
      icon: "mdi-micro-sd",
      hoverIcon: "mdi-delete-empty",
      color: "green",
      hoverColor: "red",
      readonly: false,
      action: () => (props.game.inSDCard = false), // @TODO: 移除本地存储
    };
  } else if (props.game.inDeck) {
    return {
      icon: "mdi-gamepad-square",
      hoverIcon: "mdi-delete-empty",
      color: "green",
      hoverColor: "red",
      readonly: false,
      action: () => (props.game.inDeck = false), // @TODO: 移除本地存储
    };
  } else {
    return {
      icon: "mdi-content-save-off",
      hoverIcon: "mdi-content-save-off",
      color: "blue-grey",
      hoverColor: "blue-grey",
      readonly: true,
      action: () => {},
    };
  }
});

const moveBtn = computed(() => {
  if (props.game.inDeck || props.game.inSDCard) {
    return {
      icon: "mdi-folder-move",
      color: "green",
      readonly: false,
      action: () => props.game.localMove(),
    };
  } else {
    return {
      icon: "mdi-folder-move",
      color: "blue-grey",
      readonly: true,
      action: () => {},
    };
  }
});
</script>

<template>
  <!-- <div class="game-item"> -->
  <v-sheet
    rounded="lg"
    elevation="3"
    height="100"
    style="margin: 5px 0"
    min-width="550px"
  >
    <div class="item">
      <!-- <v-container>
        <v-row> -->
      <!-- 左侧图片 -->
      <v-col class="flex-grow-0 pa-0">
        <div class="game-image">
          <img
            v-if="game.imageAssets.headerSDPath"
            :src="`file://${game.imageAssets.headerSDPath}`"
          />
          <div v-else class="game-image-placeholder"></div>
        </div>
      </v-col>

      <!-- 中间内容 -->
      <div class="game-details">
        <div v-overflow-detector="'game-name'" class="scroll-container">
          <div
            class="game-name"
            :class="{ scrolled: overflowStates['game-name'] }"
          >
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
        <div class="game-brand">{{ game.gameBrand }}</div>
        <div class="game-meta">
          {{ formatTime(game.modifiedTime) }}&nbsp&nbsp&nbsp&nbsp{{
            formatSize(game.diskUsage)
          }}
        </div>
      </div>

      <!-- 右侧按钮 -->
      <div class="game-controls">
        <!-- Link Button -->
        <v-btn
          icon
          size="x-small"
          variant="text"
          :readonly="linkBtn.readonly"
          @click="linkBtn.action"
        >
          <v-icon
            :icon="linkBtn.icon"
            :color="linkBtn.color"
            size="x-large"
          ></v-icon>
        </v-btn>

        <!-- Database Button -->
        <v-btn
          icon
          size="x-small"
          variant="text"
          :readonly="databaseBtn.readonly"
          @click="databaseBtn.action"
        >
          <v-icon
            :icon="databaseBtn.icon"
            :color="databaseBtn.color"
            size="x-large"
          ></v-icon>
        </v-btn>

        <!-- Image Button -->
        <v-btn icon size="x-small" variant="text" @click="imageBtn.action">
          <v-icon
            :icon="imageBtn.icon"
            :color="imageBtn.color"
            size="x-large"
          ></v-icon>
        </v-btn>

        <!-- Cloud Button -->
        <v-btn
          icon
          size="x-small"
          variant="text"
          :readonly="cloudBtn.readonly"
          @click="cloudBtn.action"
        >
          <v-icon
            :icon="cloudBtn.icon"
            :color="cloudBtn.color"
            size="x-large"
          ></v-icon>
        </v-btn>

        <!-- Storage Button -->
        <v-hover>
          <template v-slot:default="{ isHovering, props }">
            <v-btn
              v-bind="props"
              icon
              size="x-small"
              variant="text"
              :readonly="storageBtn.readonly"
              @click="storageBtn.action"
            >
              <v-icon
                :icon="isHovering ? storageBtn.hoverIcon : storageBtn.icon"
                :color="isHovering ? storageBtn.hoverColor : storageBtn.color"
                size="x-large"
              ></v-icon>
            </v-btn>
          </template>
        </v-hover>

        <!-- Move Button -->
        <v-btn
          icon
          size="x-small"
          variant="text"
          :readonly="moveBtn.readonly"
          @click="moveBtn.action"
        >
          <v-icon
            :icon="moveBtn.icon"
            :color="moveBtn.color"
            size="x-large"
          ></v-icon>
        </v-btn>
      </div>
    </div>
  </v-sheet>
</template>

<style scoped>
.item {
  display: flex;
  align-items: flex-start;
  max-width: 100%;
  flex-wrap: nowrap;
}

.game-item {
  display: flex;
  align-items: flex-start;
  border: 1px solid #ccc;
  border-radius: 5px;
  margin: 10px;
  padding: 10px;
  max-width: 100%;
  /* background-color: white; */
}

.game-image {
  height: 100px;
  border-radius: 5px;
  margin-right: 10px;
  aspect-ratio: 92 / 43;
}

.game-image img {
  height: 100px;
  object-fit: cover;
  border-radius: 5px;
  margin-right: 10px;
  aspect-ratio: 92 / 43;
}

.game-image-placeholder {
  height: 100px;
  border-radius: 5px;
  background-color: #f0f0f0;
  margin-right: 10px;
  aspect-ratio: 92 / 43;
}

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

/* 右侧按钮样式 */
.game-controls {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-self: flex-end;
  justify-content: space-evenly;
  /* gap: 5px; */
  margin-left: 10px;
  width: 100px;
  min-width: 100px;
  margin-bottom: 10px;
}

.func-btns {
  width: 20px;
  min-width: 20px;
  height: 20px;
  /* border: none; */
  /* border-radius: 5px; */
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  margin: 0;
}

.func-btns img {
  height: 100%;
}
</style>
