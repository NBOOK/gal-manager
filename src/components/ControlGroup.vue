<script setup lang="ts">
  import { computed } from "vue";
  import GameEntry from "@/modules/GameEntry";
  import { useGameStore } from "@/store/global-store";

  const gameStore = useGameStore();

  const props = defineProps<{ game: GameEntry }>(); // use props.game to access the game object

  const linkBtn = computed(() => {
    if (props.game.linked) {
      return {
        icon: "$mdiLinkVariant",
        iconHover: "$mdiLinkVariantMinus",
        color: "green",
        colorHover: "red",
        readonly: props.game.inLutrisDB || props.game.inSteamDB,
        action: () => props.game.unlink(),
      };
    } else {
      return {
        icon: "$mdiLinkVariantOff",
        iconHover: "$mdiLinkVariantPlus",
        color: "red",
        colorHover: "green",
        readonly: false,
        action: () => props.game.link(),
      };
    }
  });

  const databaseBtn = computed(() => {
    if (props.game.linked) {
      console.log(
        props.game.gameName,
        "Lutris: ",
        props.game.inLutrisDB,
        ", Steam: ",
        props.game.inSteamDB
      );
      if (props.game.inLutrisDB && props.game.inSteamDB) {
        return {
          icon: "$mdiDatabase",
          iconHover: "$mdiDatabaseEdit",
          color: "green",
          readonly: false,
          // action: () => props.game.removeDB(),
          action: () => gameStore.dbEditList.push(props.game),
        };
      } else if (props.game.inLutrisDB !== props.game.inSteamDB) {
        return {
          icon: "$mdiDatabaseMinus",
          iconHover: "$mdiDatabaseEdit",
          color: "orange",
          readonly: false,
          action: () => gameStore.dbEditList.push(props.game),
        };
      } else {
        return {
          icon: "$mdiDatabaseRemove",
          iconHover: "$mdiDatabaseEdit",
          color: "red",
          readonly: false,
          action: () => gameStore.dbEditList.push(props.game),
        };
      }
    } else {
      return {
        icon: "$mdiDatabaseOff",
        color: "blue-grey",
        readonly: true,
        action: () => {},
      };
    }
  });

  const imageBtn = computed(() => {
    if (props.game.imageAssets.assetsCount == 5) {
      return {
        icon: "$mdiImageCheck",
        iconHover: "$mdiFolderOpen",
        color: "green",
        action: () => props.game.imageAssets.openImageOrGameFolder(),
      };
    } else if (props.game.imageAssets.assetsCount > 0) {
      return {
        icon: "$mdiImageMinus",
        iconHover: "$mdiFolderOpen",
        color: "orange",
        action: () => props.game.imageAssets.openImageOrGameFolder(),
      };
    } else {
      return {
        icon: "$mdiImageRemove",
        iconHover: "$mdiFolderOpen",
        color: "red",
        action: () => props.game.imageAssets.openImageOrGameFolder(),
      };
    }
  });

  const cloudBtn = computed(() => {
    if (!gameStore.netDiskOnline) {
      return {
        icon: "$mdiCloudOff",
        iconHover: "$mdiCloudOff",
        color: "grey-darken-4",
        colorHover: "grey-darken-4",
        readonly: true,
        action: () => {},
      };
    } else if (props.game.inNetDisk) {
      if (props.game.inDeck || props.game.inSDCard) {
        return {
          icon: "$mdiCloudCheckVariant",
          iconHover: "$mdiContentSaveMinus",
          color: "green",
          colorHover: "red",
          readonly: false,
          action: () => {}, // delete local handled by dialog action
        };
      } else {
        return {
          icon: "$mdiCloudDownload",
          iconHover: "$mdiCloudDownload",
          color: "green",
          colorHover: "green",
          readonly: false,
          action: () => {}, // download handled by menu btngroup
        };
      }
    } else {
      if (props.game.inDeck || props.game.inSDCard) {
        return {
          icon: "$mdiCloudAlert",
          iconHover: "$mdiCloudAlert",
          color: "red",
          colorHover: "red",
          readonly: true,
          // action: () => (props.game.inNetDisk = true), // @TODO: 上传到云端
          action: () => {},
        };
      } else {
        // not in cloud or local storage, means the link is broken or name is changed
        return {
          icon: "$mdiCloudOff",
          iconHover: "$mdiCloudOff",
          color: "blue-grey",
          colorHover: "blue-grey",
          readonly: true,
          action: () => {},
        };
      }
    }
  });

  const storageBtn = computed(() => {
    if (props.game.inSDCard) {
      return {
        icon: "$mdiMicroSd",
        iconHover: "$mdiFolderMove",
        color: "green",
        hoverColor: "green",
        readonly: false,
        action: () => {}, // handled by dialog action
        // action: async () => await props.game.deleteLocal(), // @TODO: 移除本地存储
      };
    } else if (props.game.inDeck) {
      return {
        icon: "$mdiGamepadSquare",
        iconHover: "$mdiFolderMove",
        color: "green",
        hoverColor: "green",
        readonly: false,
        action: () => {},
        // action: async () => await props.game.deleteLocal(), // @TODO: 移除本地存储
      };
    } else {
      return {
        icon: "$mdiContentSaveOff",
        iconHover: "$mdiContentSaveOff",
        color: "blue-grey",
        hoverColor: "blue-grey",
        readonly: true,
        action: () => {},
      };
    }
  });

  // const moveBtn = computed(() => {
  //   if (props.game.inDeck || props.game.inSDCard) {
  //     return {
  //       icon: "$mdiFolderMove",
  //       color: "green",
  //       readonly: false,
  //       action: () => {},
  //     };
  //   } else {
  //     return {
  //       icon: "$mdiFolderMove",
  //       color: "blue-grey",
  //       readonly: true,
  //       action: () => {},
  //     };
  //   }
  // });

  const selectBtn = computed(() => {
    return {
      icon: props.game.selected
        ? "$mdiCheckboxMarked"
        : "$mdiCheckboxBlankOutline",
      color: props.game.selected ? "grey-darken-4" : "grey",
      action: () => (props.game.selected = !props.game.selected),
    };
  });

  // const starBtn = computed(() => {
  //   return {
  //     icon: props.game.starred ? "$mdiStar" : "$mdiStarOutline",
  //     color: "amber",
  //     action: () => (props.game.starred = !props.game.starred),
  //   };
  // });

  const syncBtn = computed(() => {
    if (props.game.inNetDisk && (props.game.inDeck || props.game.inSDCard)) {
      return {
        icon: "$mdiSync",
        color: "green",
        readonly: false,
        action: () => {}, // sync handled by dialog action
      };
    } else {
      return {
        icon: "$mdiSyncOff",
        color: "blue-grey",
        readonly: true,
        action: () => {},
      };
    }
  });

  function pushToDownloadList(target: string) {
    if (
      gameStore.downloadList.some(
        (item) => item.game.gameName === props.game.gameName
      )
    ) {
      return; // already in the list
    }
    gameStore.downloadList.push({
      game: props.game,
      source: props.game.linked
        ? props.game.linkedBasePath
        : props.game.basePath,
      target: target,
      progress: 0,
    });
  }
</script>

<template>
  <!-- 右侧按钮 -->
  <div class="game-controls">
    <!-- Dummy Placeholder -->
    <v-btn icon size="x-small" variant="text" class="invisible"></v-btn>
    <v-btn icon size="x-small" variant="text" class="invisible"></v-btn>

    <!-- Star Button -->
    <!-- <v-btn
      class="invisible"
      icon
      size="x-small"
      variant="text"
      @click="starBtn.action"
    >
      <v-icon
        :icon="starBtn.icon"
        :color="starBtn.color"
        size="x-large"
      ></v-icon>
    </v-btn> -->

    <!-- Select Button -->
    <v-btn icon size="x-small" variant="text" @click="selectBtn.action">
      <v-icon
        :icon="selectBtn.icon"
        :color="selectBtn.color"
        size="x-large"
      ></v-icon>
    </v-btn>

    <!-- Link Button -->
    <v-hover>
      <template v-slot:default="{ isHovering, props }">
        <v-btn
          icon
          size="x-small"
          variant="text"
          v-bind="props"
          :readonly="linkBtn.readonly"
          @click="linkBtn.action"
        >
          <v-icon
            :icon="isHovering ? linkBtn.iconHover : linkBtn.icon"
            :color="isHovering ? linkBtn.colorHover : linkBtn.color"
            size="x-large"
          ></v-icon>
        </v-btn>
      </template>
    </v-hover>

    <!-- Database Button -->
    <v-hover>
      <template v-slot:default="{ isHovering, props }">
        <v-btn
          icon
          size="x-small"
          variant="text"
          :readonly="databaseBtn.readonly"
          @click="databaseBtn.action"
          v-bind="props"
        >
          <v-icon
            :icon="isHovering ? databaseBtn.iconHover : databaseBtn.icon"
            :color="databaseBtn.color"
            size="x-large"
          ></v-icon>
        </v-btn>
      </template>
    </v-hover>

    <!-- Image Button -->
    <v-hover>
      <template v-slot:default="{ isHovering, props }">
        <v-btn
          icon
          size="x-small"
          variant="text"
          @click="imageBtn.action"
          v-bind="props"
        >
          <v-icon
            :icon="isHovering ? imageBtn.iconHover : imageBtn.icon"
            :color="imageBtn.color"
            size="x-large"
          ></v-icon>
        </v-btn>
      </template>
    </v-hover>

    <!-- Cloud Button -->
    <v-hover>
      <template v-slot:default="{ isHovering, props }">
        <v-btn
          icon
          size="x-small"
          variant="text"
          :readonly="cloudBtn.readonly"
          @click="cloudBtn.action"
          v-bind="props"
        >
          <v-icon
            :icon="isHovering ? cloudBtn.iconHover : cloudBtn.icon"
            :color="isHovering ? cloudBtn.colorHover : cloudBtn.color"
            size="x-large"
          >
          </v-icon>
          <v-menu
            v-if="cloudBtn.icon === '$mdiCloudDownload'"
            activator="parent"
            scroll-strategy="close"
            transition="slide-x-reverse-transition"
            location="start center"
            origin="end center"
          >
            <v-sheet rounded="lg">
              <v-btn-group density="compact">
                <v-btn
                  @click="
                    pushToDownloadList(gameStore.config.value.gamesDataPath)
                  "
                >
                  <v-icon variant="text">$mdiGamepadSquare</v-icon>
                </v-btn>

                <v-btn
                  @click="
                    pushToDownloadList(gameStore.config.value.gamesSDPath)
                  "
                >
                  <v-icon variant="text">$mdiMicroSd</v-icon>
                </v-btn>

                <!-- <v-btn
                  @click="
                    pushToDownloadList(gameStore.config.value.gamesUSBPath)
                  "
                >
                  <v-icon variant="text">$mdiUsb</v-icon>
                </v-btn> -->
              </v-btn-group>
            </v-sheet>
          </v-menu>
          <v-dialog
            v-if="cloudBtn.icon === '$mdiCloudCheckVariant'"
            activator="parent"
            max-width="522"
          >
            <template v-slot:default="{ isActive }">
              <v-card prepend-icon="$mdiDeleteEmpty" title="Free Local Storage">
                <v-container class="text-center py-0">
                  <v-card-subtitle>{{ game.gameName }}</v-card-subtitle>
                </v-container>
                <v-card-text>
                  Your're removing the game listed above from local storage.
                  This action is irreversible without a NetDisk backup.
                </v-card-text>
                <template v-slot:actions>
                  <v-spacer></v-spacer>
                  <v-btn
                    class="ml-auto"
                    text="Remove"
                    color="red"
                    @click="
                      async () => {
                        await game.deleteLocal();
                        isActive.value = false;
                      }
                    "
                  ></v-btn>
                  <v-btn
                    class="ml-auto"
                    text="Cancel"
                    @click="isActive.value = false"
                  ></v-btn>
                </template>
              </v-card>
            </template>
          </v-dialog>
        </v-btn>
      </template>
    </v-hover>

    <!-- Storage Button -->
    <v-hover>
      <template v-slot:default="{ isHovering, props }">
        <v-btn
          v-bind="props"
          icon
          size="x-small"
          variant="text"
          :readonly="storageBtn.readonly"
        >
          <!-- @click="storageBtn.action" -->
          <v-icon
            :icon="isHovering ? storageBtn.iconHover : storageBtn.icon"
            :color="isHovering ? storageBtn.hoverColor : storageBtn.color"
            size="x-large"
          ></v-icon>
          <v-menu
            activator="parent"
            scroll-strategy="close"
            transition="slide-x-reverse-transition"
            location="start center"
            origin="end center"
          >
            <v-sheet rounded="lg">
              <v-btn-group density="compact">
                <v-btn
                  v-if="!game.inDeck"
                  @click="
                    pushToDownloadList(gameStore.config.value.gamesDataPath)
                  "
                >
                  <v-icon variant="text">$mdiGamepadSquare</v-icon>
                </v-btn>

                <v-btn
                  v-if="!game.inSDCard"
                  @click="
                    pushToDownloadList(gameStore.config.value.gamesSDPath)
                  "
                >
                  <v-icon variant="text">$mdiMicroSd</v-icon>
                </v-btn>
              </v-btn-group>
            </v-sheet>
          </v-menu>
        </v-btn>
      </template>
    </v-hover>

    <!-- Sync Button -->
    <v-btn
      icon
      size="x-small"
      variant="text"
      :readonly="syncBtn.readonly"
      @click="syncBtn.action"
    >
      <v-icon
        :icon="syncBtn.icon"
        :color="syncBtn.color"
        size="x-large"
      ></v-icon>
    </v-btn>

    <!-- Move Button -->
    <!-- <v-btn icon size="x-small" variant="text" :readonly="moveBtn.readonly">
      <v-icon
        :icon="moveBtn.icon"
        :color="moveBtn.color"
        size="x-large"
      ></v-icon>
      <v-menu
        activator="parent"
        scroll-strategy="close"
        transition="slide-x-reverse-transition"
        location="start center"
        origin="end center"
      >
        <v-sheet rounded="lg">
          <v-btn-group density="compact">
            <v-btn
              v-if="!game.inDeck"
              @click="pushToDownloadList(gameStore.config.value.gamesDataPath)"
            >
              <v-icon variant="text">$mdiGamepadSquare</v-icon>
            </v-btn>

            <v-btn
              v-if="!game.inSDCard"
              @click="pushToDownloadList(gameStore.config.value.gamesSDPath)"
            >
              <v-icon variant="text">$mdiMicroSd</v-icon>
            </v-btn>

            <v-btn
              v-if="!game.inUSB"
              @click="pushToDownloadList(gameStore.config.value.gamesUSBPath)"
            >
              <v-icon variant="text">$mdiUsb</v-icon>
            </v-btn>
          </v-btn-group>
        </v-sheet>
      </v-menu>
    </v-btn> -->
  </div>
</template>

<style scoped>
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

  .invisible {
    visibility: hidden;
  }
</style>
