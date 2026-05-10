<template>
  <div :class="['tree-run', { 'is-variation': isVariation && !!segment.length }]">

    <!-- Linear segment: moves shown inline on one row -->
    <div v-if="segment.length" class="move-row" :style="{ paddingLeft: indent + 'px' }">
      <!-- Toggle for variations (collapsed by default) -->
      <button v-if="isVariation" class="var-toggle" @click.stop="collapsed = !collapsed">
        {{ collapsed ? '▶' : '▼' }}
      </button>

      <template v-if="!collapsed">
        <span
          v-for="node in segment"
          :key="node.id"
          :data-node-id="node.id"
          :class="['move-token', { selected: node.id === selectedId }]"
          @click.stop="$emit('select', node)"
        >
          {{ node.san }}
          <span v-if="node.annotation" class="ann-icon" :title="node.annotation">●</span>
          <button class="tok-del" @click.stop="$emit('delete', node.id)" title="Remove">✕</button>
        </span>
      </template>
      <template v-else>
        <!-- Collapsed: show only first move + ellipsis -->
        <span
          class="move-token collapsed-preview"
          @click.stop="collapsed = false"
        >{{ segment[0].san }}{{ segment.length > 1 ? ' …' : '' }}</span>
      </template>
    </div>

    <!-- Branch children (rendered after the segment) -->
    <template v-if="!collapsed && branchChildren.length">
      <!-- First child = main line continuation, no extra indent -->
      <!-- 2nd+ children = side variations, shown FIRST so they appear right at the branch point -->
      <RepertoireTree
        v-for="child in branchChildren.slice(1)"
        :key="child.id"
        :node="child"
        :selected-id="selectedId"
        :indent="indent + 16"
        :is-variation="true"
        @select="$emit('select', $event)"
        @delete="$emit('delete', $event)"
      />
      <!-- Main line continuation last -->
      <RepertoireTree
        :node="branchChildren[0]"
        :selected-id="selectedId"
        :indent="indent"
        :is-variation="false"
        @select="$emit('select', $event)"
        @delete="$emit('delete', $event)"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

defineOptions({ name: 'RepertoireTree' })

const props = defineProps({
  node: { type: Object, required: true },
  selectedId: { type: String, default: null },
  indent: { type: Number, default: 0 },
  isVariation: { type: Boolean, default: false },
})

defineEmits(['select', 'delete'])

// Collect the linear run from this node until we hit a branch (0 or 2+ children).
// Skips root node (san === '') — root is transparent, only its children matter.
const segment = computed(() => {
  if (!props.node.san) return []
  const nodes = []
  let cur = props.node
  while (cur?.san) {
    nodes.push(cur)
    if (cur.children.length === 1) cur = cur.children[0]
    else break
  }
  return nodes
})

// Children to branch into after the segment ends.
const branchChildren = computed(() => {
  const tail = segment.value.length
    ? segment.value[segment.value.length - 1]
    : props.node // root case: branch directly from root's children
  return tail.children ?? []
})

// Variations collapse by default; main line & root start expanded.
const collapsed = ref(props.isVariation)
</script>

<style scoped>
.tree-run {
  display: flex;
  flex-direction: column;
}

.move-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1px;
  padding: 2px 4px;
  border-radius: 4px;
}

.is-variation > .move-row {
  margin-top: 2px;
  border-left: 2px solid var(--border);
  border-radius: 0 4px 4px 0;
  padding-left: 6px !important;
}

.var-toggle {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.55rem;
  padding: 0 3px 0 0;
  line-height: 1;
  flex-shrink: 0;
  opacity: 0.7;
}
.var-toggle:hover { opacity: 1; color: var(--text-primary); }

.move-token {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 4px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.82rem;
  font-family: monospace;
  color: var(--text-primary);
  transition: background 0.1s;
  user-select: none;
}

.is-variation .move-token {
  color: var(--text-muted);
}

.move-token:hover {
  background: var(--btn-hover);
}

.move-token.selected {
  background: var(--bg-active);
  color: var(--text-on-dark);
  font-weight: 600;
}

.collapsed-preview {
  opacity: 0.6;
  font-style: italic;
}

.ann-icon {
  font-size: 0.55rem;
  color: #f0a030;
  vertical-align: super;
}

.tok-del {
  display: none;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.65rem;
  padding: 0 1px;
  line-height: 1;
  border-radius: 2px;
  opacity: 0.5;
}
.move-token:hover .tok-del { display: inline; }
.tok-del:hover { opacity: 1; background: rgba(255, 80, 80, 0.25); }
</style>


<style scoped>
.tree-node-wrap {
  display: flex;
  flex-direction: column;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-primary);
  transition: background 0.12s;
  user-select: none;
}

.tree-node.variation {
  color: var(--text-muted);
  font-style: italic;
}

.tree-node:hover {
  background: var(--btn-hover);
}

.tree-node.selected {
  background: var(--bg-active);
  color: var(--text-on-dark);
  font-weight: 600;
  font-style: normal;
}

.tree-toggle {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.6rem;
  padding: 0 2px;
  line-height: 1;
  flex-shrink: 0;
  opacity: 0.7;
}

.tree-toggle:hover {
  opacity: 1;
  color: var(--text-primary);
}

.tree-toggle-spacer {
  display: inline-block;
  width: 14px;
  flex-shrink: 0;
}

.tree-move {
  font-family: monospace;
}

.tree-ann-icon {
  font-size: 0.7rem;
  opacity: 0.7;
}

.tree-del {
  margin-left: auto;
  background: none;
  border: none;
  color: inherit;
  opacity: 0;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 2px;
  line-height: 1;
  border-radius: 3px;
}

.tree-node:hover .tree-del {
  opacity: 0.5;
}

.tree-del:hover {
  opacity: 1 !important;
  background: rgba(255, 80, 80, 0.2);
}
</style>
