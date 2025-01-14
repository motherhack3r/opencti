import { Close } from '@mui/icons-material';
import MoreVert from '@mui/icons-material/MoreVert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { PopoverProps } from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import makeStyles from '@mui/styles/makeStyles';
import React, { FunctionComponent, useState } from 'react';
import { graphql, useMutation } from 'react-relay';
import { useParams } from 'react-router-dom';
import { RecordSourceSelectorProxy } from 'relay-runtime';
import { useFormatter } from '../../../../components/i18n';
import { Theme } from '../../../../components/Theme';
import Transition from '../../../../components/Transition';
import { commitMutation } from '../../../../relay/environment';
import useDeletion from '../../../../utils/hooks/useDeletion';
import { deleteNode } from '../../../../utils/store';
import { CaseTemplateTasksLine_node$data } from './__generated__/CaseTemplateTasksLine_node.graphql';
import { CaseTemplateTasksLinesPaginationQuery$data } from './__generated__/CaseTemplateTasksLinesPaginationQuery.graphql';
import CaseTemplateTasksEdition from './CaseTemplateTasksEdition';

const useStyles = makeStyles<Theme>((theme) => ({
  container: {
    margin: 0,
  },
  drawerPaper: {
    minHeight: '100vh',
    width: '50%',
    position: 'fixed',
    overflow: 'auto',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    padding: 0,
  },
  header: {
    backgroundColor: theme.palette.background.nav,
    padding: '20px 20px 20px 60px',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    left: 5,
    color: 'inherit',
  },
  formContainer: {
    padding: '10px 20px 20px 20px',
  },
}));

const caseTemplateTasksPopoverDeletionMutation = graphql`
  mutation CaseTemplateTasksPopoverDeletionMutation($id: ID!) {
    caseTaskDelete(id: $id)
  }
`;

const caseTemplateTasksPopoverUnlinkMutation = graphql`
  mutation CaseTemplateTasksPopoverUnlinkMutation($id: ID!, $toId: StixRef!) {
    stixDomainObjectEdit(id: $id){
      relationDelete(toId: $toId, relationship_type: "object") {
        id
      }
    }
  }
`;

interface CaseTemplateTasksPopoverProps {
  task: CaseTemplateTasksLine_node$data,
  paginationOptions: CaseTemplateTasksLinesPaginationQuery$data,
}

const CaseTemplateTasksPopover: FunctionComponent<CaseTemplateTasksPopoverProps> = ({
  paginationOptions,
  task,
}) => {
  const classes = useStyles();
  const { t } = useFormatter();

  const { caseTemplateId } = useParams() as { caseTemplateId: string };

  const [anchorEl, setAnchorEl] = useState<PopoverProps['anchorEl']>(null);
  const [displayUpdate, setDisplayUpdate] = useState<boolean>(false);
  const [displayUnlink, setDisplayUnlink] = useState<boolean>(false);
  const [unlinking, setUnlinking] = useState<boolean>(false);

  const [commitUnlink] = useMutation(caseTemplateTasksPopoverUnlinkMutation);

  const handleOpen = (event: React.MouseEvent) => setAnchorEl(event.currentTarget);

  const handleClose = () => setAnchorEl(null);

  const {
    deleting,
    handleOpenDelete,
    displayDelete,
    handleCloseDelete,
    setDeleting,
  } = useDeletion({ handleClose });

  const handleOpenUpdate = () => {
    setDisplayUpdate(true);
    handleClose();
  };

  const handleCloseUpdate = () => setDisplayUpdate(false);

  const submitDelete = () => {
    setDeleting(true);
    commitMutation({
      mutation: caseTemplateTasksPopoverDeletionMutation,
      variables: {
        id: task.id,
      },
      updater: (store: RecordSourceSelectorProxy) => deleteNode(
        store,
        'Pagination_caseTemplate__caseTasks',
        paginationOptions,
        task.id,
      ),
      onCompleted: () => {
        setDeleting(false);
        handleCloseDelete();
      },
      optimisticUpdater: undefined,
      optimisticResponse: undefined,
      onError: undefined,
      setSubmitting: undefined,
    });
  };

  const handleOpenUnlink = () => {
    setDisplayUnlink(true);
    handleClose();
  };

  const handleCloseUnlink = () => setDisplayUnlink(false);

  const submitUnlink = () => {
    setUnlinking(true);
    commitUnlink({
      variables: {
        id: task.id,
        toId: caseTemplateId,
      },
      updater: (store: RecordSourceSelectorProxy) => deleteNode(
        store,
        'Pagination_caseTemplate__caseTasks',
        paginationOptions,
        task.id,
      ),
      onCompleted: () => {
        setUnlinking(false);
        handleCloseUnlink();
      },
    });
  };

  return (
    <div className={classes.container}>
      <IconButton onClick={handleOpen} aria-haspopup="true" size="large">
        <MoreVert />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <MenuItem onClick={handleOpenUpdate}>{t('Update')}</MenuItem>
        <MenuItem onClick={handleOpenUnlink}>{t('Unlink')}</MenuItem>
        <MenuItem onClick={handleOpenDelete}>{t('Delete')}</MenuItem>
      </Menu>
      <Drawer
        open={displayUpdate}
        anchor="right"
        sx={{ zIndex: 1202 }}
        elevation={1}
        classes={{ paper: classes.drawerPaper }}
        onClose={handleCloseUpdate}
      >
        <div className={classes.header}>
          <IconButton
            aria-label="Close"
            className={classes.closeButton}
            onClick={() => setDisplayUpdate(false)}
            size="large"
            color="primary"
          >
            <Close fontSize="small" color="primary" />
          </IconButton>
          <Typography variant="h6" classes={{ root: classes.title }}>
            {t('Update a task')}
          </Typography>
        </div>
        <div className={classes.formContainer}>
          <CaseTemplateTasksEdition task={task} />
        </div>
      </Drawer>
      <Dialog
        open={displayUnlink}
        PaperProps={{ elevation: 1 }}
        keepMounted={true}
        TransitionComponent={Transition}
        onClose={handleCloseUnlink}
      >
        <DialogContent>
          <DialogContentText>
            {t('Do you want to unlink this task ?')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUnlink} disabled={unlinking}>
            {t('Cancel')}
          </Button>
          <Button color="secondary" onClick={submitUnlink} disabled={unlinking}>
            {t('Unlink')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={displayDelete}
        PaperProps={{ elevation: 1 }}
        keepMounted={true}
        TransitionComponent={Transition}
        onClose={handleCloseDelete}
      >
        <DialogContent>
          <DialogContentText>
            {t('Do you want to delete this task ?')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelete} disabled={deleting}>
            {t('Cancel')}
          </Button>
          <Button color="secondary" onClick={submitDelete} disabled={deleting}>
            {t('Delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default CaseTemplateTasksPopover;
