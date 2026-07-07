import unreal as u
def L(m): u.log("SIG: %s"%m)
L("dup: %s" % u.IKRetargetBatchOperation.duplicate_and_retarget.__doc__)
L("run: %s" % u.IKRetargetBatchOperation.run_batch_retarget.__doc__)
L("inputs: %s" % ", ".join([p for p in dir(u.IKRetargetBatchOperationInputs) if not p.startswith('_') and 'editor' not in p]))
